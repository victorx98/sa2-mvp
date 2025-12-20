import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MeetingManagerService } from '@core/meeting';
import { CalendarService } from '@core/calendar';
import {
  COMM_SESSION_CREATED_EVENT,
  COMM_SESSION_UPDATED_EVENT,
  COMM_SESSION_CANCELLED_EVENT,
  COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events/event-constants';
import type { MeetingLifecycleCompletedPayload } from '@shared/events';
import { retryWithBackoff } from '@shared/utils/retry.util';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { FEISHU_DEFAULT_HOST_USER_ID } from 'src/constants';
import { CommSessionDomainService } from '@domains/services/comm-sessions/services/comm-session-domain.service';
import { sql } from 'drizzle-orm';
import { UserService } from '@domains/identity/user/user-service';

/**
 * Communication Session Created Event Handler
 * 
 * Handles async meeting creation flow for communication sessions
 * Communication sessions are between student and counselor/mentor for internal discussions
 * 
 * Responsibilities:
 * 1. Listen to COMM_SESSION_CREATED_EVENT
 * 2. Create meeting via MeetingManagerService
 * 3. Update session (meeting_id, status=SCHEDULED) in transaction
 * 4. Update calendar slots with meeting info
 * 5. Publish MEETING_OPERATION_RESULT_EVENT (operation: create)
 */
@Injectable()
export class CommSessionCreatedEventHandler {
  private readonly logger = new Logger(CommSessionCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly calendarService: CalendarService,
    private readonly commSessionService: CommSessionDomainService,
    private readonly eventEmitter: EventEmitter2,
    private readonly userService: UserService,
  ) {}

  @OnEvent(COMM_SESSION_CREATED_EVENT)
  async handleSessionCreated(event: any): Promise<void> {
    this.logger.log(`Handling COMM_SESSION_CREATED_EVENT: sessionId=${event.sessionId}`);

    try {
      // Step 1: Create meeting on third-party platform
      this.logger.debug(`Creating meeting for session ${event.sessionId}`);

      const meeting = await this.meetingManagerService.createMeeting({
        topic: event.topic,
        provider: event.meetingProvider as any,
        startTime: event.scheduledStartTime,
        duration: event.duration,
        hostUserId: this.getHostUserId(event.meetingProvider),
        autoRecord: false, // Communication sessions typically not recorded
        participantJoinEarly: true,
      });

      this.logger.debug(
        `Meeting created successfully: meetingId=${meeting.id}, meetingUrl=${meeting.meetingUrl}`,
      );

      // Step 2: Query user display names for calendar metadata
      const studentName = await this.userService.getDisplayName(event.studentId);

      // Step 3: Update session and calendar slots in a transaction
      await this.db.transaction(async (tx) => {
        // 3.1: Update comm_sessions table with meeting_id and status
        await this.commSessionService.scheduleMeeting(
          event.sessionId,
          meeting.id,
          tx,
        );

        this.logger.debug(`Comm session meeting setup completed: sessionId=${event.sessionId}`);

        // 3.2: Update calendar slots based on session type
        if (event.mentorId && event.mentorCalendarSlotId) {
          // Scenario 1: Student + Mentor (two slots)
          const mentorName = await this.userService.getDisplayName(event.mentorId);

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
        } else {
          // Scenario 2: Student + Counselor (single student slot)
          const counselorName = await this.userService.getDisplayName(event.counselorId);

          await this.calendarService.updateSingleSlotWithSessionAndMeeting(
            event.sessionId,
            meeting.id,
            meeting.meetingUrl,
            event.studentCalendarSlotId,
            counselorName, // Student sees counselor's real name
            tx,
          );
        }

        this.logger.debug(`Calendar slots updated for session ${event.sessionId}`);
      });

      // Step 3: Publish result event (success - notify all parties)
      this.eventEmitter.emit(COMM_SESSION_MEETING_OPERATION_RESULT_EVENT, {
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
      this.logger.error(`Failed to create meeting for session ${event.sessionId}: ${error.message}`, error.stack);

      // Publish result event (failed - notify counselor only)
      this.eventEmitter.emit(COMM_SESSION_MEETING_OPERATION_RESULT_EVENT, {
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
   * Handle COMM_SESSION_UPDATED_EVENT
   * Executes async meeting update flow when session is rescheduled
   * 
   * Responsibilities:
   * 1. Update meeting on third-party platform with retry logic
   * 2. Update meetings table with new schedule info
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: update)
   */
  @OnEvent(COMM_SESSION_UPDATED_EVENT)
  async handleSessionUpdated(event: any): Promise<void> {
    this.logger.log(
      `Handling COMM_SESSION_UPDATED_EVENT: sessionId=${event.sessionId}`,
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
                topic: event.newTitle,
                startTime: event.newScheduledAt,
                duration: event.newDuration,
              },
            );
          },
          3,
          1000,
          this.logger,
        );

        // Step 3: Update meetings table with new schedule info
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
    this.eventEmitter.emit(COMM_SESSION_MEETING_OPERATION_RESULT_EVENT, {
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
   * Handle COMM_SESSION_CANCELLED_EVENT
   * Executes async meeting cancellation flow
   * 
   * Responsibilities:
   * 1. Cancel meeting on third-party platform with retry logic
   * 2. Update meetings table status to CANCELLED
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: cancel)
   */
  @OnEvent(COMM_SESSION_CANCELLED_EVENT)
  async handleSessionCancelled(event: any): Promise<void> {
    this.logger.log(
      `Handling COMM_SESSION_CANCELLED_EVENT: sessionId=${event.sessionId}`,
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
    this.eventEmitter.emit(COMM_SESSION_MEETING_OPERATION_RESULT_EVENT, {
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

  /**
   * Handle Meeting Lifecycle Completed Event
   * Listen for meeting completion event and update session status
   */
  @OnEvent(MEETING_LIFECYCLE_COMPLETED_EVENT)
  async handleMeetingCompletion(
    payload: MeetingLifecycleCompletedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`,
    );

    try {
      const session = await this.commSessionService.findByMeetingId(
        payload.meetingId,
      );

      if (session) {
        this.logger.log(
          `Found comm session ${session.getId()} for meeting ${payload.meetingId}`,
        );

        await this.commSessionService.completeSession(session.getId());

        this.logger.log(
          `Successfully completed comm session ${session.getId()}`,
        );
      } else {
        this.logger.debug(
          `No comm session found for meeting ${payload.meetingId}, skipping`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling meeting completion for meeting ${payload.meetingId}: ${error.message}`,
        error.stack,
      );
    }
  }
}

