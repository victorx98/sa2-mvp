import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MeetingManagerService } from '@core/meeting';
import { CalendarService } from '@core/calendar';
import {
  CLASS_SESSION_CREATED_EVENT,
  CLASS_SESSION_UPDATED_EVENT,
  CLASS_SESSION_CANCELLED_EVENT,
  CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT,
} from '@shared/events/event-constants';
import { retryWithBackoff } from '@shared/utils/retry.util';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { FEISHU_DEFAULT_HOST_USER_ID } from 'src/constants';
import { ClassSessionService } from '@domains/services/class/class-sessions/services/class-session.service';
import { sql } from 'drizzle-orm';

/**
 * Class Session Created Event Handler
 * 
 * Handles async meeting creation flow for class sessions
 * Class sessions are group sessions for multiple students in a class
 * 
 * Responsibilities:
 * 1. Listen to CLASS_SESSION_CREATED_EVENT
 * 2. Create meeting via MeetingManagerService
 * 3. Update session (meeting_id, status=SCHEDULED) in transaction
 * 4. Update calendar slots with meeting info
 * 5. Publish MEETING_OPERATION_RESULT_EVENT (operation: create)
 */
@Injectable()
export class ClassSessionCreatedEventHandler {
  private readonly logger = new Logger(ClassSessionCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly calendarService: CalendarService,
    private readonly classSessionService: ClassSessionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(CLASS_SESSION_CREATED_EVENT)
  async handleSessionCreated(event: any): Promise<void> {
    this.logger.log(`Handling CLASS_SESSION_CREATED_EVENT: sessionId=${event.sessionId}`);

    try {
      // Step 1: Create meeting on third-party platform
      this.logger.debug(`Creating meeting for session ${event.sessionId}`);

      const meeting = await this.meetingManagerService.createMeeting({
        topic: event.topic,
        provider: event.meetingProvider as any,
        startTime: event.scheduledStartTime,
        duration: event.duration,
        hostUserId: this.getHostUserId(event.meetingProvider),
        autoRecord: true, // Class sessions typically recorded for student review
        participantJoinEarly: true,
      });

      this.logger.debug(
        `Meeting created successfully: meetingId=${meeting.id}, meetingUrl=${meeting.meetingUrl}`,
      );

      // Step 2: Update session and calendar slot in a transaction
      await this.db.transaction(async (tx) => {
        // 2.1: Update class_sessions table with meeting_id and status
        await this.classSessionService.updateMeetingSetup(
          event.sessionId,
          meeting.id,
          tx,
        );

        this.logger.debug(`Class session meeting setup completed: sessionId=${event.sessionId}`);

        // 2.2: Update mentor calendar slot with meeting info
        // Class sessions only have mentor slot (group session)
        await this.calendarService.updateSingleSlotWithSessionAndMeeting(
          event.sessionId,
          meeting.id,
          meeting.meetingUrl,
          event.mentorCalendarSlotId,
          'Class Session', // Display name for group session
          tx,
        );

        this.logger.debug(`Calendar slot updated for session ${event.sessionId}`);
      });

      // Step 3: Publish result event (success - notify counselor and mentor)
      this.eventEmitter.emit(CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT, {
        operation: 'create',
        status: 'success',
        sessionId: event.sessionId,
        classId: event.classId,
        mentorId: event.mentorId,
        scheduledAt: event.scheduledStartTime,
        duration: event.duration,
        meetingUrl: meeting.meetingUrl,
        meetingProvider: event.meetingProvider,
        notifyRoles: ['counselor', 'mentor'],
      });

      this.logger.log(
        `MEETING_OPERATION_RESULT_EVENT published: operation=create, status=success, sessionId=${event.sessionId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create meeting for session ${event.sessionId}: ${error.message}`, error.stack);

      // Publish result event (failed - notify counselor only)
      this.eventEmitter.emit(CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT, {
        operation: 'create',
        status: 'failed',
        sessionId: event.sessionId,
        classId: event.classId,
        mentorId: event.mentorId,
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
   * Handle CLASS_SESSION_UPDATED_EVENT
   * Executes async meeting update flow when session is rescheduled
   * 
   * Responsibilities:
   * 1. Update meeting on third-party platform with retry logic
   * 2. Update meetings table with new schedule info
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: update)
   */
  @OnEvent(CLASS_SESSION_UPDATED_EVENT)
  async handleSessionUpdated(event: any): Promise<void> {
    this.logger.log(
      `Handling CLASS_SESSION_UPDATED_EVENT: sessionId=${event.sessionId}`,
    );

    let updateSuccess = false;
    let errorMessage = '';

    try {
      // Step 1: Check if meeting is updatable
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
                topic: event.topic,
                startTime: event.newScheduledStartTime,
                duration: event.newDuration,
              },
            );
          },
          3,
          1000,
          this.logger,
        );

        // Step 3: Update meetings table with new schedule info
        const startTime = new Date(event.newScheduledStartTime);
        await this.db.execute(sql`
          UPDATE meetings 
          SET 
            topic = ${event.topic},
            schedule_start_time = ${startTime.toISOString()},
            schedule_duration = ${event.newDuration},
            updated_at = NOW()
          WHERE id = ${event.meetingId}
        `);
        this.logger.debug(`Meetings table updated: meetingId=${event.meetingId}`);

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
    this.eventEmitter.emit(CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT, {
      operation: 'update',
      status: updateSuccess ? 'success' : 'failed',
      sessionId: event.sessionId,
      meetingId: event.meetingId,
      classId: event.classId,
      mentorId: event.mentorId,
      newScheduledAt: event.newScheduledStartTime,
      newDuration: event.newDuration,
      errorMessage: updateSuccess ? undefined : errorMessage,
      notifyRoles: updateSuccess ? ['counselor', 'mentor'] : ['counselor'],
      requireManualIntervention: !updateSuccess,
    });

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=update, status=${updateSuccess ? 'success' : 'failed'}, sessionId=${event.sessionId}`,
    );
  }

  /**
   * Handle CLASS_SESSION_CANCELLED_EVENT
   * Executes async meeting cancellation flow
   * 
   * Responsibilities:
   * 1. Cancel meeting on third-party platform with retry logic
   * 2. Update meetings table status to CANCELLED
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: cancel)
   */
  @OnEvent(CLASS_SESSION_CANCELLED_EVENT)
  async handleSessionCancelled(event: any): Promise<void> {
    this.logger.log(
      `Handling CLASS_SESSION_CANCELLED_EVENT: sessionId=${event.sessionId}`,
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

    // Step 4: Publish result event based on result
    this.eventEmitter.emit(CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT, {
      operation: 'cancel',
      status: cancelSuccess ? 'success' : 'failed',
      sessionId: event.sessionId,
      meetingId: event.meetingId,
      classId: event.classId,
      mentorId: event.mentorId,
      cancelledAt: event.cancelledAt,
      cancelReason: event.cancelReason,
      errorMessage: cancelSuccess ? undefined : errorMessage,
      notifyRoles: cancelSuccess ? ['counselor', 'mentor'] : ['counselor'],
      requireManualIntervention: !cancelSuccess,
    });

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=cancel, status=${cancelSuccess ? 'success' : 'failed'}, sessionId=${event.sessionId}`,
    );
  }

  /**
   * Check if meeting is cancellable
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
   * Check if meeting is updatable
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
      this.logger.error(`Error checking meeting status: ${error.message}`);
      return false;
    }
  }

  private getHostUserId(provider: string): string | undefined {
    if (provider === 'feishu') {
      return FEISHU_DEFAULT_HOST_USER_ID;
    }
    return undefined;
  }
}

