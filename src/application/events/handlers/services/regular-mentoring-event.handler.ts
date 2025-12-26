import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { sql } from 'drizzle-orm';
import { MeetingManagerService } from '@core/meeting';
import { RegularMentoringDomainService } from '@domains/services/sessions/regular-mentoring/services/regular-mentoring-domain.service';
import { ServiceRegistryService } from '@domains/services/service-registry/services/service-registry.service';
import {
  HandlesEvent,
  IntegrationEventPublisher,
  MeetingLifecycleCompletedEvent,
  RegularMentoringSessionCancelledEvent,
  RegularMentoringSessionMeetingOperationResultEvent,
  RegularMentoringSessionUpdatedEvent,
  ServiceSessionCompletedEvent,
} from '@application/events';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { retryWithBackoff } from '@shared/utils/retry.util';

/**
 * Regular Mentoring Session Event Handler
 *
 * Note: session creation provisioning is handled by SessionProvisioningSaga.
 * This handler keeps update/cancel/lifecycle logic for regular mentoring sessions.
 */
@Injectable()
export class RegularMentoringCreatedEventHandler {
  private readonly logger = new Logger(RegularMentoringCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly domainRegularMentoringService: RegularMentoringDomainService,
    private readonly serviceRegistryService: ServiceRegistryService,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {}

  /**
   * Handle REGULAR_MENTORING_SESSION_UPDATED_EVENT
   * Executes async meeting update flow when session is rescheduled
   * 
   * Responsibilities:
   * 1. Update meeting on third-party platform with retry logic
   * 2. Update meetings table with new schedule info
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: update)
   */
  @OnEvent(RegularMentoringSessionUpdatedEvent.eventType)
  @HandlesEvent(RegularMentoringSessionUpdatedEvent.eventType, RegularMentoringCreatedEventHandler.name)
  async handleSessionUpdated(event: RegularMentoringSessionUpdatedEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling REGULAR_MENTORING_SESSION_UPDATED_EVENT: sessionId=${payload.sessionId}`,
    );

    let updateSuccess = false;
    let errorMessage = '';

    try {
      // Step 1: Check if meeting is in updatable state (scheduled/active)
      this.logger.debug(`Updating meeting ${payload.meetingId} for session ${payload.sessionId}`);

      const canUpdate = await this.isMeetingUpdatable(payload.meetingId);
      
      if (!canUpdate) {
        updateSuccess = false;
        errorMessage = 'Meeting is in a non-updatable state (cancelled/ended). Update skipped.';
        this.logger.warn(`${errorMessage} meetingId=${payload.meetingId}`);
      } else {
        // Step 2: Update meeting on third-party platform with retry (max 3 times)
        await retryWithBackoff(
          async () => {
            await this.meetingManagerService.updateMeeting(
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
          3, // Max retries
          1000, // Initial delay
          this.logger,
        );

        // Step 3: Update meetings table in database with new schedule info
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
        this.logger.debug(`Meetings table updated: topic=${payload.newTitle}, scheduleStartTime=${startTime.toISOString()}, scheduleDuration=${payload.newDuration}`);

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
      new RegularMentoringSessionMeetingOperationResultEvent({
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
      RegularMentoringCreatedEventHandler.name,
    );

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=update, status=${updateSuccess ? 'success' : 'failed'}, sessionId=${payload.sessionId}`,
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
  @OnEvent(RegularMentoringSessionCancelledEvent.eventType)
  @HandlesEvent(RegularMentoringSessionCancelledEvent.eventType, RegularMentoringCreatedEventHandler.name)
  async handleSessionCancelled(event: RegularMentoringSessionCancelledEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling REGULAR_MENTORING_SESSION_CANCELLED_EVENT: sessionId=${payload.sessionId}`,
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
          // Step 2: Cancel meeting on third-party platform with retry (max 3 times)
          await retryWithBackoff(
            async () => {
              await this.meetingManagerService.cancelMeeting(payload.meetingId);
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
      new RegularMentoringSessionMeetingOperationResultEvent({
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
      RegularMentoringCreatedEventHandler.name,
    );

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=cancel, status=${cancelSuccess ? 'success' : 'failed'}, sessionId=${payload.sessionId}`,
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
   * Handle Meeting Lifecycle Completed Event
   * 
   * Orchestrates session completion flow:
   * 1. Find session by meetingId
   * 2. Complete session (update status)
   * 3. Register service reference (with actual duration in hours)
   * 4. Publish SERVICE_SESSION_COMPLETED_EVENT (for downstream domains)
   */
  @OnEvent(MeetingLifecycleCompletedEvent.eventType)
  @HandlesEvent(MeetingLifecycleCompletedEvent.eventType, RegularMentoringCreatedEventHandler.name)
  async handleMeetingCompletion(
    event: MeetingLifecycleCompletedEvent,
  ): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`,
    );

    try {
      // Find session by meetingId
      const session = await this.domainRegularMentoringService.findByMeetingId(
        payload.meetingId,
      );

      if (!session) {
        this.logger.debug(
          `No regular mentoring session found for meeting ${payload.meetingId}, skipping`,
        );
        return;
      }

      this.logger.log(
        `Found regular mentoring session ${session.getId()} for meeting ${payload.meetingId}`,
      );

      // Execute completion flow in transaction
      await this.db.transaction(async (tx) => {
        // Step 1: Complete session (update status to COMPLETED)
        await this.domainRegularMentoringService.completeSession(session.getId(), tx);

        // Step 2: Calculate consumed hours from actual duration (seconds -> hours)
        const actualDurationHours = payload.actualDuration / 3600;

        // Step 3: Register service reference (for billing and contract tracking)
        await this.serviceRegistryService.registerService(
          {
            id: session.getId(),
            service_type: session.getSessionType(),
            title: session.getTitle(),
            student_user_id: session.getStudentUserId(),
            provider_user_id: session.getMentorUserId(),
            consumed_units: actualDurationHours,
            unit_type: 'hour', // Session units are measured in hours
            completed_time: typeof payload.endedAt === 'string'
              ? new Date(payload.endedAt)
              : payload.endedAt,
          },
          tx,
        );

        this.logger.log(
          `Successfully registered service reference for session ${session.getId()}, consumed ${actualDurationHours.toFixed(2)} hours`,
        );
      });

      // Step 4: Publish SERVICE_SESSION_COMPLETED_EVENT for downstream domains
      // Convert durations from seconds/minutes to minutes for consistency
      const actualDurationMinutes = Math.round(payload.actualDuration / 60);
      const scheduledDurationMinutes = payload.scheduleDuration;

      await this.eventPublisher.publish(
        new ServiceSessionCompletedEvent({
          sessionId: session.getId(),
          studentId: session.getStudentUserId(),
          mentorId: session.getMentorUserId(),
          serviceTypeCode: session.getServiceType() || 'External', // Business-level service type
          sessionTypeCode: session.getSessionType(), // Technical session type (regular_mentoring)
          actualDurationMinutes,
          durationMinutes: scheduledDurationMinutes,
          allowBilling: true, // Session completed successfully
        }),
        RegularMentoringCreatedEventHandler.name,
      );

      this.logger.log(
        `Successfully completed regular mentoring session ${session.getId()} and published SERVICE_SESSION_COMPLETED_EVENT`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling meeting completion for meeting ${payload.meetingId}: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw to trigger retry if configured
    }
  }
}
