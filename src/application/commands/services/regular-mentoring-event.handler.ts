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
  REGULAR_MENTORING_SESSION_CANCELLED_EVENT,
  REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT,
} from '@shared/events/event-constants';
import type { RegularMentoringSessionCreatedEvent } from '@shared/events';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { FEISHU_DEFAULT_HOST_USER_ID } from 'src/constants';
import { retryWithBackoff } from '@shared/utils/retry.util';
import { UserService } from '@domains/identity/user/user-service';

/**
 * Regular Mentoring Session Created Event Handler
 * 
 * Handles async meeting creation flow triggered by RegularMentoringService.createSession()
 * 
 * Responsibilities:
 * 1. Listen to REGULAR_MENTORING_SESSION_CREATED_EVENT
 * 2. Create meeting via MeetingManagerService
 * 3. Update session (meeting_id, status=SCHEDULED) in transaction
 * 4. Update calendar slots with meeting info
 * 5. Publish MEETING_OPERATION_RESULT_EVENT (operation: create)
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
    private readonly userService: UserService,
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

      // Step 2: Query user display names for calendar metadata
      const mentorName = await this.userService.getDisplayName(event.mentorId);
      const studentName = await this.userService.getDisplayName(event.studentId);

      // Step 3: Update session and calendar slots in a transaction
      await this.db.transaction(async (tx) => {
        // 3.1: Complete meeting setup for session (update meeting_id and status)
        await this.domainRegularMentoringService.completeMeetingSetup(
          event.sessionId,
          meeting.id,
          tx,
        );

        this.logger.debug(`Session meeting setup completed: sessionId=${event.sessionId}`);

        // 3.2: Update calendar slots with session_id, meeting_id, meetingUrl, and otherPartyName
        await this.calendarService.updateSlotWithSessionAndMeeting(
          event.sessionId,
          meeting.id,
          meeting.meetingUrl,
          event.mentorCalendarSlotId,
          event.studentCalendarSlotId,
          mentorName,
          studentName,
          tx,
        );

        this.logger.debug(
          `Calendar slots updated: mentorSlotId=${event.mentorCalendarSlotId}, studentSlotId=${event.studentCalendarSlotId}`,
        );
      });

      // Step 3: Publish result event (success - notify all parties)
      this.eventEmitter.emit(REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT, {
        operation: 'create',
        status: 'success',
        sessionId: event.sessionId,
        studentId: event.studentId,
        mentorId: event.mentorId,
        counselorId: event.counselorId,
        scheduledAt: event.scheduledStartTime,
        duration: event.duration,
        meetingUrl: meeting.meetingUrl,
        meetingProvider: event.meetingProvider,
        notifyRoles: ['counselor', 'mentor', 'student'],
      });

      this.logger.log(
        `MEETING_OPERATION_RESULT_EVENT published: operation=create, status=success, sessionId=${event.sessionId}`,
      );
    } catch (error) {
      // Error handling: Log error and publish failed result event
      this.logger.error(
        `Failed to create meeting for session ${event.sessionId}: ${error.message}`,
        error.stack,
      );

      // Publish result event (failed - notify counselor only)
      this.eventEmitter.emit(REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT, {
        operation: 'create',
        status: 'failed',
        sessionId: event.sessionId,
        studentId: event.studentId,
        mentorId: event.mentorId,
        counselorId: event.counselorId,
        scheduledAt: event.scheduledStartTime,
        errorMessage: error.message,
        notifyRoles: ['counselor'],
        requireManualIntervention: true,
      });

      this.logger.warn(
        `MEETING_OPERATION_RESULT_EVENT published: operation=create, status=failed, sessionId=${event.sessionId}`,
      );
    }
  }

  /**
   * Handle REGULAR_MENTORING_SESSION_UPDATED_EVENT
   * Executes async meeting update flow when session is rescheduled
   * 
   * Responsibilities:
   * 1. Update meeting on third-party platform with retry logic
   * 2. Update meetings table with new schedule info
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: update)
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

    // Step 4: Publish result event based on result
    this.eventEmitter.emit(REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT, {
      operation: 'update',
      status: updateSuccess ? 'success' : 'failed',
      sessionId: event.sessionId,
      meetingId: event.meetingId,
      studentId: event.studentId,
      mentorId: event.mentorId,
      counselorId: event.counselorId,
      newScheduledAt: event.newScheduledAt,
      newDuration: event.newDuration,
      errorMessage: updateSuccess ? undefined : errorMessage,
      notifyRoles: updateSuccess ? ['counselor', 'mentor', 'student'] : ['counselor'],
      requireManualIntervention: !updateSuccess,
    });

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=update, status=${updateSuccess ? 'success' : 'failed'}, sessionId=${event.sessionId}`,
    );
  }

  /**
   * Handle REGULAR_MENTORING_SESSION_CANCELLED_EVENT
   * Executes async meeting cancellation flow
   * 
   * Responsibilities:
   * 1. Cancel meeting on third-party platform with retry logic
   * 2. Update meetings table status to CANCELLED
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: cancel)
   */
  @OnEvent(REGULAR_MENTORING_SESSION_CANCELLED_EVENT)
  async handleSessionCancelled(event: any): Promise<void> {
    this.logger.log(
      `Handling REGULAR_MENTORING_SESSION_CANCELLED_EVENT: sessionId=${event.sessionId}`,
    );

    let cancelSuccess = false;
    let errorMessage = '';

    try {
      // Step 1: Check if meeting exists and is cancellable
      if (!event.meetingId) {
        cancelSuccess = false;
        errorMessage = 'No meeting ID found, session was in PENDING_MEETING state';
        this.logger.warn(`${errorMessage} sessionId=${event.sessionId}`);
      } else {
        const canCancel = await this.isMeetingCancellable(event.meetingId);

        if (!canCancel) {
          cancelSuccess = false;
          errorMessage = 'Meeting is already cancelled or ended';
          this.logger.warn(`${errorMessage} meetingId=${event.meetingId}`);
        } else {
          // Step 2: Cancel meeting on third-party platform with retry (max 3 times)
          await retryWithBackoff(
            async () => {
              await this.meetingManagerService.cancelMeeting(event.meetingId);
            },
            3, // Max retries
            1000, // Initial delay
            this.logger,
          );

          // Step 3: Update meetings table status to CANCELLED
          await this.db.execute(sql`
            UPDATE meetings 
            SET 
              status = 'cancelled',
              updated_at = NOW()
            WHERE id = ${event.meetingId}
          `);

          cancelSuccess = true;
          this.logger.debug(`Meeting ${event.meetingId} cancelled successfully`);
        }
      }
    } catch (error) {
      cancelSuccess = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Failed to cancel meeting ${event.meetingId}: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );
    }

    // Step 4: Publish result event based on result
    this.eventEmitter.emit(REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT, {
      operation: 'cancel',
      status: cancelSuccess ? 'success' : 'failed',
      sessionId: event.sessionId,
      meetingId: event.meetingId,
      studentId: event.studentId,
      mentorId: event.mentorId,
      counselorId: event.counselorId,
      cancelledAt: event.cancelledAt,
      cancelReason: event.cancelReason,
      errorMessage: cancelSuccess ? undefined : errorMessage,
      notifyRoles: cancelSuccess ? ['counselor', 'mentor', 'student'] : ['counselor'],
      requireManualIntervention: !cancelSuccess,
    });

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=cancel, status=${cancelSuccess ? 'success' : 'failed'}, sessionId=${event.sessionId}`,
    );
  }

  /**
   * Check if meeting is cancellable
   * Prevents trying to cancel already cancelled or ended meetings
   * 
   * @param meetingId - Meeting ID
   * @returns true if meeting can be cancelled, false otherwise
   */
  private async isMeetingCancellable(meetingId: string): Promise<boolean> {
    try {
      const result = await this.db.execute(sql`
        SELECT status FROM meetings WHERE id = ${meetingId}
      `);

      if (result.rows.length === 0) {
        return false; // Meeting not found
      }

      const status = (result.rows[0] as any).status;

      // Only allow cancellation if status is 'scheduled' or 'active'
      return status === 'scheduled' || status === 'active';
    } catch (error) {
      this.logger.warn(`Failed to check meeting cancellable status: ${error}`);
      return false; // Safe to fail-closed
    }
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

