import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { sql } from 'drizzle-orm';
import { MeetingManagerService } from '@core/meeting';
import { CalendarService } from '@core/calendar';
import { RegularMentoringService as DomainRegularMentoringService } from '@domains/services/sessions/regular-mentoring/services/regular-mentoring.service';
import {
  REGULAR_MENTORING_SESSION_CREATED_EVENT,
  REGULAR_MENTORING_SESSION_UPDATED_EVENT,
  SESSION_BOOKED_EVENT,
  SESSION_RESCHEDULED_COMPLETED,
} from '@shared/events/event-constants';
import type { RegularMentoringSessionCreatedEvent } from '@shared/events';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { FEISHU_DEFAULT_HOST_USER_ID } from 'src/constants';
import { retryWithBackoff } from '@shared/utils/retry.util';

/**
 * Regular Mentoring Session Created Event Handler
 * 
 * Handles the asynchronous meeting creation flow triggered by RegularMentoringService.createSession()
 * 
 * Responsibilities:
 * 1. Listen to REGULAR_MENTORING_SESSION_CREATED_EVENT (precise subscription, no filtering needed)
 * 2. Call MeetingManagerService to create meeting on third-party platform
 * 3. Update session with meeting_id and status in database transaction
 * 4. Update calendar slots with session_id, meeting_id, and meetingUrl
 * 5. Publish SESSION_BOOKED_EVENT to trigger notification flows
 * 
 * Design principles:
 * - No type-based filtering (event name is already type-specific)
 * - Graceful error handling (update session status to MEETING_FAILED if creation fails)
 * - Atomic operations (use transactions for consistency)
 * - Loosely coupled (only depends on public interfaces)
 */
@Injectable()
export class RegularMentoringCreatedEventHandler {
  private readonly logger = new Logger(RegularMentoringCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly domainRegularMentoringService: DomainRegularMentoringService,
    private readonly calendarService: CalendarService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle REGULAR_MENTORING_SESSION_CREATED_EVENT
   * Executes the async meeting creation flow
   * 
   * @param event - Regular mentoring session created event
   */
  @OnEvent(REGULAR_MENTORING_SESSION_CREATED_EVENT)
  async handleSessionCreated(event: RegularMentoringSessionCreatedEvent): Promise<void> {
    this.logger.log(
      `Handling REGULAR_MENTORING_SESSION_CREATED_EVENT: sessionId=${event.sessionId}`,
    );

    try {
      // Step 1: Create meeting on third-party platform with retry mechanism (max 3 retries)
      this.logger.debug(`Creating meeting for session ${event.sessionId}`);

      const meeting = await retryWithBackoff(
        async () => {
          return await this.meetingManagerService.createMeeting({
        topic: event.topic,
        provider: event.meetingProvider as any,
        startTime: event.scheduledStartTime,
        duration: event.duration,
        hostUserId: this.getHostUserId(event.meetingProvider),
        autoRecord: true,
        participantJoinEarly: true,
      });
        },
        3, // Max retries
        1000, // Initial delay
        this.logger,
      );

      this.logger.debug(
        `Meeting created successfully: meetingId=${meeting.id}, meetingNo=${meeting.meetingNo}, meetingUrl=${meeting.meetingUrl}`,
      );

      // Step 2: Update session and calendar slots in a transaction
      await this.db.transaction(async (tx) => {
        // 2.1: Complete meeting setup for session (update meeting_id and status)
        await this.domainRegularMentoringService.completeMeetingSetup(
          event.sessionId,
          meeting.id,
          tx,
        );

        this.logger.debug(`Session meeting setup completed: sessionId=${event.sessionId}`);

        // 2.2: Update calendar slots with session_id, meeting_id, and meetingUrl
        await this.calendarService.updateSlotWithSessionAndMeeting(
          event.sessionId,
          meeting.id,
          meeting.meetingUrl,
          event.mentorCalendarSlotId,
          event.studentCalendarSlotId,
          tx,
        );

        this.logger.debug(
          `Calendar slots updated: mentorSlotId=${event.mentorCalendarSlotId}, studentSlotId=${event.studentCalendarSlotId}`,
        );
      });

      // Step 3: Publish SESSION_BOOKED_EVENT (outside transaction)
      this.eventEmitter.emit(SESSION_BOOKED_EVENT, {
        sessionId: event.sessionId,
        studentId: event.studentId,
        mentorId: event.mentorId,
        counselorId: event.counselorId,
        serviceType: 'regular_mentoring',
        mentorCalendarSlotId: event.mentorCalendarSlotId,
        studentCalendarSlotId: event.studentCalendarSlotId,
        serviceHoldId: null, // TODO: Implement service hold if needed
        scheduledStartTime: event.scheduledStartTime,
        duration: event.duration,
        meetingProvider: event.meetingProvider,
        meetingPassword: null, // Not implemented in current meeting providers
        meetingUrl: meeting.meetingUrl,
      });

      this.logger.log(
        `SESSION_BOOKED_EVENT published: sessionId=${event.sessionId}, meetingUrl=${meeting.meetingUrl}`,
      );
    } catch (error) {
      // Error handling: Log error and update session status to MEETING_FAILED
      this.logger.error(
        `Failed to create meeting for session ${event.sessionId}: ${error.message}`,
        error.stack,
      );

      // Note: We're not calling updateStatus() method as per requirements
      // The session will remain in PENDING_MEETING status or need manual intervention
      // In future, consider implementing a retry mechanism or manual retry endpoint
    }
  }

  /**
   * Handle REGULAR_MENTORING_SESSION_UPDATED_EVENT
   * Executes the async meeting update flow when session is rescheduled
   * 
   * Responsibilities:
   * 1. Update meeting on third-party platform (Feishu/Zoom) with retry logic
   * 2. Update meetings table with new schedule info
   * 3. Publish SESSION_RESCHEDULED_NOTIFICATION event for downstream notifications
   * 
   * @param event - Session update event containing meeting and schedule details
   */
  @OnEvent(REGULAR_MENTORING_SESSION_UPDATED_EVENT)
  async handleSessionUpdated(event: any): Promise<void> {
    this.logger.log(
      `Handling REGULAR_MENTORING_SESSION_UPDATED_EVENT: sessionId=${event.sessionId}`,
    );

    let updateSuccess = false;
    let errorMessage = '';

    try {
      // Step 1: Check if meeting is in updatable state (scheduled/active)
      this.logger.debug(`Updating meeting ${event.meetingId} for session ${event.sessionId}`);

      const canUpdate = await this.isMeetingUpdatable(event.meetingId);
      
      if (!canUpdate) {
        updateSuccess = false;
        errorMessage = 'Meeting is in a non-updatable state (cancelled/ended). Update skipped.';
        this.logger.warn(`${errorMessage} meetingId=${event.meetingId}`);
      } else {
        // Step 2: Update meeting on third-party platform with retry (max 3 times)
        await retryWithBackoff(
          async () => {
            await this.meetingManagerService.updateMeeting(
              event.meetingId,
              {
                topic: event.newTitle,
                startTime: event.newScheduledAt,
                duration: event.newDuration,
              },
            );
          },
          3, // Max retries
          1000, // Initial delay
          this.logger,
        );

        // Step 3: Update meetings table in database with new schedule info
        const startTime = new Date(event.newScheduledAt);
        await this.db.execute(sql`
          UPDATE meetings 
          SET 
            topic = ${event.newTitle},
            schedule_start_time = ${startTime.toISOString()},
            schedule_duration = ${event.newDuration},
            updated_at = NOW()
          WHERE id = ${event.meetingId}
        `);
        this.logger.debug(`Meetings table updated: topic=${event.newTitle}, scheduleStartTime=${startTime.toISOString()}, scheduleDuration=${event.newDuration}`);

        updateSuccess = true;
        this.logger.debug(`Meeting ${event.meetingId} updated successfully`);
      }

    } catch (error) {
      updateSuccess = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error(
        `Failed to update meeting ${event.meetingId}: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );
    }

    // Step 2: Emit notification event (whether meeting update succeeded or failed)
    this.eventEmitter.emit(SESSION_RESCHEDULED_COMPLETED, {
      sessionId: event.sessionId,
      meetingUpdateSuccess: updateSuccess,
      errorMessage,
      mentorId: event.mentorId,
      studentId: event.studentId,
      counselorId: event.counselorId,
      newScheduledAt: event.newScheduledAt,
      newDuration: event.newDuration,
    });

    this.logger.log(
      `SESSION_RESCHEDULED_COMPLETED published for session ${event.sessionId}, updateSuccess=${updateSuccess}`,
    );
  }

  /**
   * Check if meeting is in updatable state
   * Prevents trying to update cancelled or ended meetings
   * 
   * @param meetingId - Meeting ID
   * @returns true if meeting can be updated, false otherwise
   */
  private async isMeetingUpdatable(meetingId: string): Promise<boolean> {
    try {
      // Query meeting status from database
      const result = await this.db.execute(sql`
        SELECT status FROM meetings WHERE id = ${meetingId}
      `);

      if (result.rows.length === 0) {
        return false; // Meeting not found
      }

      const status = (result.rows[0] as any).status;
      
      // Only allow update if status is 'scheduled' or 'active'
      // Skip update for 'cancelled' or 'ended' states
      return status === 'scheduled' || status === 'active';
    } catch (error) {
      this.logger.warn(`Failed to check meeting status: ${error}`);
      return false; // Safe to fail-closed
    }
  }


  /**
   * Determine host user ID based on meeting provider
   * Used to specify who will host the meeting on the third-party platform
   * 
   * @param provider - Meeting provider type ('feishu' | 'zoom')
   * @returns Host user ID or undefined
   */
  private getHostUserId(provider: string): string | undefined {
    // For Feishu, use system default host ID (Feishu open_id constant)
    // For Zoom, return undefined to use authenticated account
    if (provider === 'feishu') {
      return FEISHU_DEFAULT_HOST_USER_ID;
    }
    return undefined;
  }
}

