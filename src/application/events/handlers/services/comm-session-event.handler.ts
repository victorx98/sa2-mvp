import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MeetingManagerService } from '@core/meeting';
import {
  CommSessionCancelledEvent,
  CommSessionMeetingOperationResultEvent,
  CommSessionUpdatedEvent,
  HandlesEvent,
  IntegrationEventPublisher,
  MeetingLifecycleCompletedEvent,
} from '@application/events';
import { retryWithBackoff } from '@shared/utils/retry.util';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { CommSessionDomainService } from '@domains/services/comm-sessions/services/comm-session-domain.service';
import { sql } from 'drizzle-orm';

/**
 * Communication Session Event Handler
 *
 * Note: session creation provisioning is handled by SessionProvisioningSaga.
 * This handler keeps update/cancel/lifecycle logic for comm sessions.
 */
@Injectable()
export class CommSessionCreatedEventHandler {
  private readonly logger = new Logger(CommSessionCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly commSessionService: CommSessionDomainService,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {}

  /**
   * Handle COMM_SESSION_UPDATED_EVENT
   * Executes async meeting update flow when session is rescheduled
   * 
   * Responsibilities:
   * 1. Update meeting on third-party platform with retry logic
   * 2. Update meetings table with new schedule info
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: update)
   */
  @OnEvent(CommSessionUpdatedEvent.eventType)
  @HandlesEvent(CommSessionUpdatedEvent.eventType, CommSessionCreatedEventHandler.name)
  async handleSessionUpdated(event: CommSessionUpdatedEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling COMM_SESSION_UPDATED_EVENT: sessionId=${payload.sessionId}`,
    );

    let updateSuccess = false;
    let errorMessage = '';

    try {
      // Step 1: Check if meeting is updatable
      const isMeetingUpdatable = await this.isMeetingUpdatable(payload.meetingId);
      if (!isMeetingUpdatable) {
        updateSuccess = false;
        errorMessage = 'Meeting is in a non-updatable state (cancelled/ended). Update skipped.';
        this.logger.warn(`${errorMessage} meetingId=${payload.meetingId}`);
      } else {
        // Step 2: Update external meeting platform with retry mechanism (max 3 retries)
        await retryWithBackoff(
          async () => {
            return await this.meetingManagerService.updateMeeting(
              payload.meetingId,
              {
                topic: payload.newTitle,
                startTime: typeof payload.newScheduledAt === 'string'
                  ? payload.newScheduledAt
                  : payload.newScheduledAt.toISOString(),
                duration: payload.newDuration,
              },
            );
          },
          3,
          1000,
          this.logger,
        );

        // Step 3: Update meetings table with new schedule info
        const startTime = new Date(payload.newScheduledAt);
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
    } catch (error) {
      updateSuccess = false;
      errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error(
        `Failed to update meeting ${payload.meetingId}: ${errorMessage}`,
        error instanceof Error ? error.stack : '',
      );
    }

    // Step 4: Publish result event based on result
    await this.eventPublisher.publish(
      new CommSessionMeetingOperationResultEvent({
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
      }),
      CommSessionCreatedEventHandler.name,
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
  @OnEvent(CommSessionCancelledEvent.eventType)
  @HandlesEvent(CommSessionCancelledEvent.eventType, CommSessionCreatedEventHandler.name)
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
    await this.eventPublisher.publish(
      new CommSessionMeetingOperationResultEvent({
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
      }),
      CommSessionCreatedEventHandler.name,
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

  /**
   * Handle Meeting Lifecycle Completed Event
   * Listen for meeting completion event and update session status
   */
  @OnEvent(MeetingLifecycleCompletedEvent.eventType)
  @HandlesEvent(MeetingLifecycleCompletedEvent.eventType, CommSessionCreatedEventHandler.name)
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
