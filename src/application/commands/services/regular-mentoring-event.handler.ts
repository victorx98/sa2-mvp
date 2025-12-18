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
  SESSION_BOOKED_EVENT,
  SESSION_RESCHEDULED_COMPLETED,
} from '@shared/events/event-constants';
import type { RegularMentoringSessionCreatedEvent } from '@shared/events';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { FEISHU_DEFAULT_HOST_USER_ID } from 'src/constants';
import { retryWithBackoff } from '@shared/utils/retry.util';
import { SessionBookingSaga, SessionBookingSagaInput } from '@events/sagas/session-booking.saga';

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
    private readonly sessionBookingSaga: SessionBookingSaga,
  ) {}

  /**
   * Handle REGULAR_MENTORING_SESSION_CREATED_EVENT
   * Executes the async meeting creation flow using Saga Orchestrator
   *
   * Uses SessionBookingSaga which provides:
   * - Automatic retry with exponential backoff
   * - Automatic compensation on failure (cancel meeting if created)
   * - Correlation ID tracking for debugging
   * - Unified event emission for success/failure
   *
   * @param event - Regular mentoring session created event
   */
  @OnEvent(REGULAR_MENTORING_SESSION_CREATED_EVENT)
  async handleSessionCreated(event: RegularMentoringSessionCreatedEvent): Promise<void> {
    this.logger.log(
      `Handling REGULAR_MENTORING_SESSION_CREATED_EVENT via Saga: sessionId=${event.sessionId}`,
    );

    // Build saga input from event
    const sagaInput: SessionBookingSagaInput = {
      sessionId: event.sessionId,
      studentId: event.studentId,
      mentorId: event.mentorId,
      counselorId: event.counselorId,
      topic: event.topic,
      meetingProvider: event.meetingProvider,
      scheduledStartTime: new Date(event.scheduledStartTime),
      duration: event.duration,
      mentorCalendarSlotId: event.mentorCalendarSlotId,
      studentCalendarSlotId: event.studentCalendarSlotId,
      serviceType: 'regular_mentoring',
    };

    // Execute saga - it handles all retry, compensation, and event emission
    const result = await this.sessionBookingSaga.execute(sagaInput);

    if (result.success) {
      this.logger.log(
        `Session booking saga completed successfully: sessionId=${event.sessionId}, ` +
        `meetingId=${result.result?.meetingId}, duration=${result.duration}ms`,
      );
    } else {
      this.logger.warn(
        `Session booking saga failed: sessionId=${event.sessionId}, ` +
        `error=${result.error?.message}, compensated=${result.compensatedSteps.length} steps`,
      );
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

    // Step 4: Publish unified result event based on result
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

    this.logger.log(
      `SESSION_RESCHEDULED_COMPLETED published for session ${event.sessionId}, updateSuccess=${updateSuccess}`,
    );
  }

  /**
   * Handle REGULAR_MENTORING_SESSION_CANCELLED_EVENT
   * Executes the async meeting cancellation flow
   * 
   * Responsibilities:
   * 1. Cancel meeting on third-party platform (Feishu/Zoom) with retry logic (max 3 times)
   * 2. Update meetings table status to CANCELLED
   * 3. Publish success/failed event based on result:
   *    - Success: Notify counselor + mentor + student
   *    - Failed: Notify counselor only (requires manual retry)
   * 
   * @param event - Session cancellation event
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

    // Step 4: Publish unified result event based on result
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

