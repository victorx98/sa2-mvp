import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MeetingManagerService } from '@core/meeting';
import { CalendarService } from '@core/calendar';
import { VerifiedEventBus } from '@infrastructure/eventing/verified-event-bus';
import {
  COMM_SESSION_CREATED_EVENT,
  COMM_SESSION_UPDATED_EVENT,
  COMM_SESSION_CANCELLED_EVENT,
  COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events/event-constants';
import { HandlesEvent } from '@shared/events/registry';
import type {
  CommSessionCancelledEvent,
  CommSessionCreatedEvent,
  CommSessionUpdatedEvent,
  MeetingLifecycleCompletedEvent,
} from '@shared/events';
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
    private readonly eventBus: VerifiedEventBus,
    private readonly userService: UserService,
  ) {}

  @OnEvent(COMM_SESSION_CREATED_EVENT)
  @HandlesEvent(COMM_SESSION_CREATED_EVENT, 'ServicesModule')
  async handleSessionCreated(event: CommSessionCreatedEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(`Handling COMM_SESSION_CREATED_EVENT: sessionId=${payload.sessionId}`);

    try {
      // Step 1: Create meeting on third-party platform
      this.logger.debug(`Creating meeting for session ${payload.sessionId}`);

      const meeting = await this.meetingManagerService.createMeeting({
        topic: payload.topic,
        provider: payload.meetingProvider as any,
        startTime: payload.scheduledStartTime,
        duration: payload.duration,
        hostUserId: this.getHostUserId(payload.meetingProvider),
        autoRecord: false, // Communication sessions typically not recorded
        participantJoinEarly: true,
      });

      this.logger.debug(
        `Meeting created successfully: meetingId=${meeting.id}, meetingUrl=${meeting.meetingUrl}`,
      );

      // Step 2: Query user display names for calendar metadata
      const studentName = await this.userService.getDisplayName(payload.studentId);

      // Step 3: Update session and calendar slots in a transaction
      await this.db.transaction(async (tx) => {
        // 3.1: Update comm_sessions table with meeting_id and status
        await this.commSessionService.scheduleMeeting(
          payload.sessionId,
          meeting.id,
          tx,
        );

        this.logger.debug(
          `Comm session meeting setup completed: sessionId=${payload.sessionId}`,
        );

        // 3.2: Update calendar slots based on session type
        if (payload.mentorId && payload.mentorCalendarSlotId) {
          // Scenario 1: Student + Mentor (two slots)
          const mentorName = await this.userService.getDisplayName(payload.mentorId);

          await this.calendarService.updateSlotWithSessionAndMeeting(
            payload.sessionId,
            meeting.id,
            meeting.meetingUrl,
            payload.mentorCalendarSlotId,
            payload.studentCalendarSlotId,
            mentorName,
            studentName,
            tx,
          );
        } else {
          // Scenario 2: Student + Counselor (single student slot)
          const counselorName = await this.userService.getDisplayName(payload.counselorId);

          await this.calendarService.updateSingleSlotWithSessionAndMeeting(
            payload.sessionId,
            meeting.id,
            meeting.meetingUrl,
            payload.studentCalendarSlotId,
            counselorName, // Student sees counselor's real name
            tx,
          );
        }

        this.logger.debug(`Calendar slots updated for session ${payload.sessionId}`);
      });

      // Step 3: Publish result event (success - notify all parties)
      this.eventBus.publish(
        {
          type: COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
          payload: {
            operation: 'create',
            status: 'success',
            sessionId: payload.sessionId,
            studentId: payload.studentId,
            mentorId: payload.mentorId,
            counselorId: payload.counselorId,
            scheduledAt: payload.scheduledStartTime,
            duration: payload.duration,
            meetingUrl: meeting.meetingUrl,
            meetingProvider: payload.meetingProvider,
            notifyRoles: ['counselor', 'mentor', 'student'],
          },
          source: { domain: 'services', service: 'CommSessionCreatedEventHandler' },
        },
        'ServicesModule',
      );

      this.logger.log(
        `MEETING_OPERATION_RESULT_EVENT published: operation=create, status=success, sessionId=${payload.sessionId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create meeting for session ${payload.sessionId}: ${error.message}`,
        error.stack,
      );

      // Publish result event (failed - notify counselor only)
      this.eventBus.publish(
        {
          type: COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
          payload: {
            operation: 'create',
            status: 'failed',
            sessionId: payload.sessionId,
            studentId: payload.studentId,
            mentorId: payload.mentorId,
            counselorId: payload.counselorId,
            scheduledAt: payload.scheduledStartTime,
            errorMessage: error.message,
            notifyRoles: ['counselor'],
            requireManualIntervention: true,
          },
          source: { domain: 'services', service: 'CommSessionCreatedEventHandler' },
        },
        'ServicesModule',
      );

      this.logger.warn(
        `MEETING_OPERATION_RESULT_EVENT published: operation=create, status=failed, sessionId=${payload.sessionId}`,
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
  @HandlesEvent(COMM_SESSION_UPDATED_EVENT, 'ServicesModule')
  async handleSessionUpdated(event: CommSessionUpdatedEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling COMM_SESSION_UPDATED_EVENT: sessionId=${payload.sessionId}`,
    );

    let updateSuccess = false;
    let errorMessage = '';

    try {
      if (!payload.meetingId) {
        updateSuccess = false;
        errorMessage = "No meeting ID found, session was in PENDING_MEETING state";
        this.logger.warn(`${errorMessage} sessionId=${payload.sessionId}`);
      } else {
        // Step 1: Check if meeting is updatable
        const isMeetingUpdatable = await this.isMeetingUpdatable(payload.meetingId);
        if (!isMeetingUpdatable) {
          updateSuccess = false;
          errorMessage =
            "Meeting is in a non-updatable state (cancelled/ended). Update skipped.";
          this.logger.warn(`${errorMessage} meetingId=${payload.meetingId}`);
        } else {
          // Step 2: Update external meeting platform with retry mechanism (max 3 retries)
          await retryWithBackoff(
            async () => {
              return await this.meetingManagerService.updateMeeting(payload.meetingId, {
                topic: payload.newTitle,
                startTime: payload.newScheduledAt as any,
                duration: payload.newDuration,
              });
            },
            3,
            1000,
            this.logger,
          );

          // Step 3: Update meetings table with new schedule info
          const startTime = new Date(payload.newScheduledAt as any);
          await this.db.execute(sql`
            UPDATE meetings 
            SET 
              topic = ${payload.newTitle},
              schedule_start_time = ${startTime.toISOString()},
              schedule_duration = ${payload.newDuration},
              updated_at = NOW()
            WHERE id = ${payload.meetingId}
          `);
          this.logger.debug(`Meetings table updated: meetingId=${payload.meetingId}`);

          updateSuccess = true;
          this.logger.debug(`Meeting ${payload.meetingId} updated successfully`);
        }
      }
    } catch (error) {
      updateSuccess = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error(
        `Failed to update meeting ${payload.meetingId}: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );
    }

    // Step 4: Publish result event based on result
    this.eventBus.publish(
      {
        type: COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
        payload: {
          operation: 'update',
          status: updateSuccess ? 'success' : 'failed',
          sessionId: payload.sessionId,
          meetingId: payload.meetingId,
          studentId: payload.studentId,
          mentorId: payload.mentorId,
          counselorId: payload.counselorId,
          newScheduledAt: payload.newScheduledAt,
          newDuration: payload.newDuration,
          errorMessage: updateSuccess ? undefined : errorMessage,
          notifyRoles: updateSuccess ? ['counselor', 'mentor', 'student'] : ['counselor'],
          requireManualIntervention: !updateSuccess,
        },
        source: { domain: 'services', service: 'CommSessionCreatedEventHandler' },
      },
      'ServicesModule',
    );

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=update, status=${updateSuccess ? 'success' : 'failed'}, sessionId=${payload.sessionId}`,
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
  @HandlesEvent(COMM_SESSION_CANCELLED_EVENT, 'ServicesModule')
  async handleSessionCancelled(event: CommSessionCancelledEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling COMM_SESSION_CANCELLED_EVENT: sessionId=${payload.sessionId}`,
    );

    let cancelSuccess = false;
    let errorMessage = '';

    try {
      // Step 1: Check if meeting exists and is cancellable
      if (!payload.meetingId) {
        cancelSuccess = false;
        errorMessage = 'No meeting ID found, session was in PENDING_MEETING state';
        this.logger.warn(`${errorMessage} sessionId=${payload.sessionId}`);
      } else {
        const canCancel = await this.isMeetingCancellable(payload.meetingId);

        if (!canCancel) {
          cancelSuccess = false;
          errorMessage = 'Meeting is already cancelled or ended';
          this.logger.warn(`${errorMessage} meetingId=${payload.meetingId}`);
        } else {
          // Step 2: Cancel meeting with retry (max 3 times)
          await retryWithBackoff(
            async () => {
              await this.meetingManagerService.cancelMeeting(payload.meetingId);
            },
            3,
            1000,
            this.logger,
          );

          // Step 3: Update meetings table status
          await this.db.execute(sql`
            UPDATE meetings 
            SET status = 'cancelled', updated_at = NOW()
            WHERE id = ${payload.meetingId}
          `);

          cancelSuccess = true;
          this.logger.debug(`Meeting ${payload.meetingId} cancelled successfully`);
        }
      }
    } catch (error) {
      cancelSuccess = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(
        `Failed to cancel meeting ${payload.meetingId}: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );
    }

    // Step 4: Publish result event based on result
    this.eventBus.publish(
      {
        type: COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
        payload: {
          operation: 'cancel',
          status: cancelSuccess ? 'success' : 'failed',
          sessionId: payload.sessionId,
          meetingId: payload.meetingId,
          studentId: payload.studentId,
          mentorId: payload.mentorId,
          counselorId: payload.counselorId,
          cancelledAt: payload.cancelledAt,
          cancelReason: payload.cancelReason,
          errorMessage: cancelSuccess ? undefined : errorMessage,
          notifyRoles: cancelSuccess ? ['counselor', 'mentor', 'student'] : ['counselor'],
          requireManualIntervention: !cancelSuccess,
        },
        source: { domain: 'services', service: 'CommSessionCreatedEventHandler' },
      },
      'ServicesModule',
    );

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=cancel, status=${cancelSuccess ? 'success' : 'failed'}, sessionId=${payload.sessionId}`,
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
  @HandlesEvent(MEETING_LIFECYCLE_COMPLETED_EVENT, 'ServicesModule')
  async handleMeetingCompletion(
    event: MeetingLifecycleCompletedEvent,
  ): Promise<void> {
    const payload = event.payload;
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
