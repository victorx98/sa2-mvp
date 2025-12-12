import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MeetingManagerService } from '@core/meeting';
import { CalendarService } from '@core/calendar';
import { GapAnalysisService as DomainGapAnalysisService } from '@domains/services/sessions/gap-analysis/services/gap-analysis.service';
import {
  GAP_ANALYSIS_SESSION_CREATED_EVENT,
  GAP_ANALYSIS_SESSION_UPDATED_EVENT,
  GAP_ANALYSIS_SESSION_CANCELLED_EVENT,
  GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT,
  SESSION_BOOKED_EVENT,
  SESSION_RESCHEDULED_COMPLETED,
} from '@shared/events/event-constants';
import type { GapAnalysisSessionCreatedEvent } from '@shared/events';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { FEISHU_DEFAULT_HOST_USER_ID } from 'src/constants';
import { sql } from 'drizzle-orm';
import { retryWithBackoff } from '@shared/utils/retry.util';

/**
 * Gap Analysis Session Created Event Handler
 * 
 * Handles the asynchronous meeting creation flow triggered by GapAnalysisService.createSession()
 * 
 * Responsibilities:
 * 1. Listen to GAP_ANALYSIS_SESSION_CREATED_EVENT (precise subscription, no filtering needed)
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
export class GapAnalysisCreatedEventHandler {
  private readonly logger = new Logger(GapAnalysisCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly domainGapAnalysisService: DomainGapAnalysisService,
    private readonly calendarService: CalendarService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle GAP_ANALYSIS_SESSION_CREATED_EVENT
   * Executes the async meeting creation flow
   * 
   * @param event - Gap analysis session created event
   */
  @OnEvent(GAP_ANALYSIS_SESSION_CREATED_EVENT)
  async handleSessionCreated(event: GapAnalysisSessionCreatedEvent): Promise<void> {
    this.logger.log(
      `Handling GAP_ANALYSIS_SESSION_CREATED_EVENT: sessionId=${event.sessionId}`,
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
        await this.domainGapAnalysisService.completeMeetingSetup(
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
        serviceType: 'gap_analysis',
        mentorCalendarSlotId: event.mentorCalendarSlotId,
        studentCalendarSlotId: event.studentCalendarSlotId,
        serviceHoldId: null,
        scheduledStartTime: event.scheduledStartTime,
        duration: event.duration,
        meetingProvider: event.meetingProvider,
        meetingPassword: null,
        meetingUrl: meeting.meetingUrl,
      });

      this.logger.log(
        `SESSION_BOOKED_EVENT published: sessionId=${event.sessionId}, meetingUrl=${meeting.meetingUrl}`,
      );

      // Step 4: Publish unified result event (success)
      this.eventEmitter.emit(GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT, {
        operation: 'create',
        status: 'success',
        sessionId: event.sessionId,
        studentId: event.studentId,
        mentorId: event.mentorId,
        counselorId: event.counselorId,
        scheduledAt: event.scheduledStartTime,
        meetingUrl: meeting.meetingUrl,
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

      // Publish unified result event (failed)
      this.eventEmitter.emit(GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT, {
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
   * Handle GAP_ANALYSIS_SESSION_UPDATED_EVENT
   * Executes the async meeting update flow when time or duration changes
   * 
   * @param event - Gap analysis session updated event
   */
  @OnEvent(GAP_ANALYSIS_SESSION_UPDATED_EVENT)
  async handleSessionUpdated(event: any): Promise<void> {
    this.logger.log(
      `Handling GAP_ANALYSIS_SESSION_UPDATED_EVENT: sessionId=${event.sessionId}`,
    );

    let updateSuccess = false;
    let errorMessage = '';

    try {
      // Step 1: Check if meeting is in an updatable state (not cancelled/ended)
      const isMeetingUpdatable = await this.isMeetingUpdatable(event.meetingId);
      if (!isMeetingUpdatable) {
        updateSuccess = false;
        errorMessage = 'Meeting is in a non-updatable state (cancelled/ended). Update skipped.';
        this.logger.warn(`${errorMessage} meetingId=${event.meetingId}`);
      } else {
        // Step 2: Update external meeting platform with retry mechanism (max 3 retries)
        await retryWithBackoff(
          async () => {
            return await this.meetingManagerService.updateMeeting(
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
        this.logger.debug(`Meetings table updated: topic=${event.newTitle}, scheduleStartTime=${startTime.toISOString()}`);

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

    // Step 4: Publish unified result event
    this.eventEmitter.emit(GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT, {
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

    // Step 5: Emit legacy notification event (for backward compatibility)
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
  }

  /**
   * Handle GAP_ANALYSIS_SESSION_CANCELLED_EVENT
   * Executes the async meeting cancellation flow
   * 
   * @param event - Session cancellation event
   */
  @OnEvent(GAP_ANALYSIS_SESSION_CANCELLED_EVENT)
  async handleSessionCancelled(event: any): Promise<void> {
    this.logger.log(
      `Handling GAP_ANALYSIS_SESSION_CANCELLED_EVENT: sessionId=${event.sessionId}`,
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
          // Step 2: Cancel meeting with retry (max 3 times)
          await retryWithBackoff(
            async () => {
              await this.meetingManagerService.cancelMeeting(event.meetingId);
            },
            3,
            1000,
            this.logger,
          );

          // Step 3: Update meetings table status
          await this.db.execute(sql`
            UPDATE meetings 
            SET status = 'cancelled', updated_at = NOW()
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

    // Step 4: Publish unified result event
    this.eventEmitter.emit(GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT, {
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
   * 
   * @param meetingId - Meeting ID
   * @returns True if meeting can be cancelled, false otherwise
   */
  private async isMeetingCancellable(meetingId: string): Promise<boolean> {
    try {
      const result = await this.db.execute(sql`
        SELECT status FROM meetings WHERE id = ${meetingId}
      `);

      if (result.rows.length === 0) {
        return false;
      }

      const status = (result.rows[0] as any).status;
      return status === 'scheduled' || status === 'active';
    } catch (error) {
      this.logger.warn(`Failed to check meeting cancellable status: ${error}`);
      return false;
    }
  }

  /**
   * Check if meeting is in an updatable state (not cancelled/ended)
   * Only 'scheduled' or 'active' status meetings can be updated
   * 
   * @param meetingId - Meeting ID
   * @returns True if meeting can be updated, false otherwise
   */
  private async isMeetingUpdatable(meetingId: string): Promise<boolean> {
    try {
      const result = await this.db.execute(
        sql`SELECT status FROM meetings WHERE id = ${meetingId}`,
      );
      const row = (result as any).rows?.[0];
      if (!row) {
        this.logger.warn(`Meeting not found: ${meetingId}`);
        return false;
      }
      // Only allow update for 'scheduled' or 'active' status
      return row.status === 'scheduled' || row.status === 'active';
    } catch (error) {
      this.logger.error(`Failed to check meeting status for ${meetingId}: ${error.message}`);
      return false;
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

