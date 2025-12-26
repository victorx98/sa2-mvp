import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MeetingManagerService } from '@core/meeting';
import { GapAnalysisDomainService } from '@domains/services/sessions/gap-analysis/services/gap-analysis-domain.service';
import { ServiceRegistryService } from '@domains/services/service-registry/services/service-registry.service';
import {
  GapAnalysisSessionCancelledEvent,
  GapAnalysisSessionMeetingOperationResultEvent,
  GapAnalysisSessionUpdatedEvent,
  HandlesEvent,
  IntegrationEventPublisher,
  MeetingLifecycleCompletedEvent,
  ServiceSessionCompletedEvent,
} from '@application/events';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { sql } from 'drizzle-orm';
import { retryWithBackoff } from '@shared/utils/retry.util';

/**
 * Gap Analysis Session Event Handler
 *
 * Note: session creation provisioning is handled by SessionProvisioningSaga.
 * This handler keeps update/cancel/lifecycle logic for gap analysis sessions.
 */
@Injectable()
export class GapAnalysisCreatedEventHandler {
  private readonly logger = new Logger(GapAnalysisCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly domainGapAnalysisService: GapAnalysisDomainService,
    private readonly serviceRegistryService: ServiceRegistryService,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {}

  /**
   * Handle GAP_ANALYSIS_SESSION_UPDATED_EVENT
   * Executes async meeting update flow when session is rescheduled
   * 
   * Responsibilities:
   * 1. Update meeting on third-party platform with retry logic
   * 2. Update meetings table with new schedule info
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: update)
   */
  @OnEvent(GapAnalysisSessionUpdatedEvent.eventType)
  @HandlesEvent(GapAnalysisSessionUpdatedEvent.eventType, GapAnalysisCreatedEventHandler.name)
  async handleSessionUpdated(event: GapAnalysisSessionUpdatedEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling GAP_ANALYSIS_SESSION_UPDATED_EVENT: sessionId=${payload.sessionId}`,
    );

    let updateSuccess = false;
    let errorMessage = '';

    try {
      // Step 1: Check if meeting is in an updatable state (not cancelled/ended)
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
        this.logger.debug(`Meetings table updated: topic=${payload.newTitle}, scheduleStartTime=${startTime.toISOString()}`);

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
      new GapAnalysisSessionMeetingOperationResultEvent({
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
      GapAnalysisCreatedEventHandler.name,
    );

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=update, status=${updateSuccess ? 'success' : 'failed'}, sessionId=${payload.sessionId}`,
    );
  }

  /**
   * Handle GAP_ANALYSIS_SESSION_CANCELLED_EVENT
   * Executes async meeting cancellation flow
   * 
   * Responsibilities:
   * 1. Cancel meeting on third-party platform with retry logic
   * 2. Update meetings table status to CANCELLED
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: cancel)
   */
  @OnEvent(GapAnalysisSessionCancelledEvent.eventType)
  @HandlesEvent(GapAnalysisSessionCancelledEvent.eventType, GapAnalysisCreatedEventHandler.name)
  async handleSessionCancelled(event: GapAnalysisSessionCancelledEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling GAP_ANALYSIS_SESSION_CANCELLED_EVENT: sessionId=${payload.sessionId}`,
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
      new GapAnalysisSessionMeetingOperationResultEvent({
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
      GapAnalysisCreatedEventHandler.name,
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
   * Handle Meeting Lifecycle Completed Event
   * Listen for meeting completion event and update session status
   */
  /**
   * Handle Meeting Lifecycle Completed Event
   * 
   * Orchestrates session completion flow:
   * 1. Find session by meetingId
   * 2. Complete session (update status)
   * 3. Register service reference (for billing)
   * 4. Publish SERVICE_SESSION_COMPLETED_EVENT (for downstream domains)
   */
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
  @HandlesEvent(MeetingLifecycleCompletedEvent.eventType, GapAnalysisCreatedEventHandler.name)
  async handleMeetingCompletion(
    event: MeetingLifecycleCompletedEvent,
  ): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`,
    );

    try {
      // Find session by meetingId
      const session = await this.domainGapAnalysisService.findByMeetingId(
        payload.meetingId,
      );

      if (!session) {
        this.logger.debug(
          `No gap analysis session found for meeting ${payload.meetingId}, skipping`,
        );
        return;
      }

      this.logger.log(
        `Found gap analysis session ${session.getId()} for meeting ${payload.meetingId}`,
      );

      // Execute completion flow in transaction
      await this.db.transaction(async (tx) => {
        // Step 1: Complete session (update status to COMPLETED)
        await this.domainGapAnalysisService.completeSession(session.getId(), tx);

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
      const actualDurationMinutes = Math.round(payload.actualDuration / 60);
      const scheduledDurationMinutes = payload.scheduleDuration;

      await this.eventPublisher.publish(
        new ServiceSessionCompletedEvent({
          sessionId: session.getId(),
          studentId: session.getStudentUserId(),
          mentorId: session.getMentorUserId(),
          serviceTypeCode: session.getServiceType() || 'External',
          sessionTypeCode: session.getSessionType(),
          actualDurationMinutes,
          durationMinutes: scheduledDurationMinutes,
          allowBilling: true,
        }),
        GapAnalysisCreatedEventHandler.name,
      );

      this.logger.log(
        `Successfully completed gap analysis session ${session.getId()} and published SERVICE_SESSION_COMPLETED_EVENT`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling meeting completion for meeting ${payload.meetingId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
