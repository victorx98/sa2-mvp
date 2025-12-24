import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MeetingManagerService } from '@core/meeting';
import { CalendarService } from '@core/calendar';
import { AiCareerDomainService } from '@domains/services/sessions/ai-career/services/ai-career-domain.service';
import { ServiceRegistryService } from '@domains/services/service-registry/services/service-registry.service';
import {
  AiCareerSessionCancelledEvent,
  AiCareerSessionCreatedEvent,
  AiCareerSessionMeetingOperationResultEvent,
  AiCareerSessionUpdatedEvent,
  HandlesEvent,
  IntegrationEventPublisher,
  MeetingLifecycleCompletedEvent,
  ServiceSessionCompletedEvent,
} from '@application/events';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { FEISHU_DEFAULT_HOST_USER_ID } from 'src/constants';
import { sql } from 'drizzle-orm';
import { retryWithBackoff } from '@shared/utils/retry.util';
import { UserService } from '@domains/identity/user/user-service';

/**
 * AI Career Session Created Event Handler
 * 
 * Handles async meeting creation flow triggered by AiCareerService.createSession()
 * 
 * Responsibilities:
 * 1. Listen to AI_CAREER_SESSION_CREATED_EVENT
 * 2. Create meeting via MeetingManagerService
 * 3. Update session (meeting_id, status=SCHEDULED) in transaction
 * 4. Update calendar slots with meeting info
 * 5. Publish MEETING_OPERATION_RESULT_EVENT (operation: create)
 */
@Injectable()
export class AiCareerCreatedEventHandler {
  private readonly logger = new Logger(AiCareerCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly domainAiCareerService: AiCareerDomainService,
    private readonly serviceRegistryService: ServiceRegistryService,
    private readonly calendarService: CalendarService,
    private readonly eventPublisher: IntegrationEventPublisher,
    private readonly userService: UserService,
  ) {}

  /**
   * Handle AI_CAREER_SESSION_CREATED_EVENT
   * Executes the async meeting creation flow
   * 
   * @param event - AI career session created event
   */
  @OnEvent(AiCareerSessionCreatedEvent.eventType)
  @HandlesEvent(AiCareerSessionCreatedEvent.eventType, AiCareerCreatedEventHandler.name)
  async handleSessionCreated(event: AiCareerSessionCreatedEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling AI_CAREER_SESSION_CREATED_EVENT: sessionId=${payload.sessionId}`,
    );

    try {
      // Step 1: Create meeting on third-party platform with retry mechanism (max 3 retries)
      this.logger.debug(`Creating meeting for session ${payload.sessionId}`);

      const meeting = await retryWithBackoff(
        async () => {
          return await this.meetingManagerService.createMeeting({
            topic: payload.topic,
            provider: payload.meetingProvider as any,
            startTime: typeof payload.scheduledStartTime === 'string' 
              ? payload.scheduledStartTime 
              : payload.scheduledStartTime.toISOString(),
            duration: payload.duration,
            hostUserId: this.getHostUserId(payload.meetingProvider),
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
      const mentorName = await this.userService.getDisplayName(payload.mentorId);
      const studentName = await this.userService.getDisplayName(payload.studentId);

      // Step 3: Update session and calendar slots in a transaction
      await this.db.transaction(async (tx) => {
        // 3.1: Complete meeting setup for session (update meeting_id and status)
        await this.domainAiCareerService.scheduleMeeting(
          payload.sessionId,
          meeting.id,
          tx,
        );

        this.logger.debug(`Session meeting setup completed: sessionId=${payload.sessionId}`);

        // 3.2: Update calendar slots with session_id, meeting_id, meetingUrl, and otherPartyName
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

        this.logger.debug(
          `Calendar slots updated: mentorSlotId=${payload.mentorCalendarSlotId}, studentSlotId=${payload.studentCalendarSlotId}`,
        );
      });

      // Step 3: Publish result event (success - notify all parties)
      await this.eventPublisher.publish(
        new AiCareerSessionMeetingOperationResultEvent({
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
        }),
        AiCareerCreatedEventHandler.name,
      );

      this.logger.log(
        `MEETING_OPERATION_RESULT_EVENT published: operation=create, status=success, sessionId=${payload.sessionId}`,
      );
    } catch (error) {
      // Error handling: Log error and publish failed result event
      this.logger.error(
        `Failed to create meeting for session ${payload.sessionId}: ${error.message}`,
        error.stack,
      );

      // Publish result event (failed - notify counselor only)
      await this.eventPublisher.publish(
        new AiCareerSessionMeetingOperationResultEvent({
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
        }),
        AiCareerCreatedEventHandler.name,
      );

      this.logger.warn(
        `MEETING_OPERATION_RESULT_EVENT published: operation=create, status=failed, sessionId=${payload.sessionId}`,
      );
    }
  }

  /**
   * Handle AI_CAREER_SESSION_UPDATED_EVENT
   * Executes async meeting update flow when session is rescheduled
   * 
   * Responsibilities:
   * 1. Update meeting on third-party platform with retry logic
   * 2. Update meetings table with new schedule info
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: update)
   */
  @OnEvent(AiCareerSessionUpdatedEvent.eventType)
  @HandlesEvent(AiCareerSessionUpdatedEvent.eventType, AiCareerCreatedEventHandler.name)
  async handleSessionUpdated(event: AiCareerSessionUpdatedEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling AI_CAREER_SESSION_UPDATED_EVENT: sessionId=${payload.sessionId}`,
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
      new AiCareerSessionMeetingOperationResultEvent({
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
      AiCareerCreatedEventHandler.name,
    );

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=update, status=${updateSuccess ? 'success' : 'failed'}, sessionId=${payload.sessionId}`,
    );
  }

  /**
   * Handle AI_CAREER_SESSION_CANCELLED_EVENT
   * Executes async meeting cancellation flow
   * 
   * Responsibilities:
   * 1. Cancel meeting on third-party platform with retry logic
   * 2. Update meetings table status to CANCELLED
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: cancel)
   */
  @OnEvent(AiCareerSessionCancelledEvent.eventType)
  @HandlesEvent(AiCareerSessionCancelledEvent.eventType, AiCareerCreatedEventHandler.name)
  async handleSessionCancelled(event: AiCareerSessionCancelledEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling AI_CAREER_SESSION_CANCELLED_EVENT: sessionId=${payload.sessionId}`,
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
      new AiCareerSessionMeetingOperationResultEvent({
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
      AiCareerCreatedEventHandler.name,
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
  @HandlesEvent(MeetingLifecycleCompletedEvent.eventType, AiCareerCreatedEventHandler.name)
  async handleMeetingCompletion(
    event: MeetingLifecycleCompletedEvent,
  ): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`,
    );

    try {
      const session = await this.domainAiCareerService.findByMeetingId(
        payload.meetingId,
      );

      if (!session) {
        this.logger.debug(
          `No AI career session found for meeting ${payload.meetingId}, skipping`,
        );
        return;
      }

      this.logger.log(
        `Found AI career session ${session.getId()} for meeting ${payload.meetingId}`,
      );

      // Execute completion flow in transaction
      await this.db.transaction(async (tx) => {
        // Step 1: Complete session (update status to COMPLETED)
        await this.domainAiCareerService.completeSession(session.getId(), tx);

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
          serviceTypeCode: session.getServiceType() || 'Internal',
          sessionTypeCode: session.getSessionType(),
          actualDurationMinutes,
          durationMinutes: scheduledDurationMinutes,
          allowBilling: true,
        }),
        AiCareerCreatedEventHandler.name,
      );

      this.logger.log(
        `Successfully completed AI career session ${session.getId()} and published SERVICE_SESSION_COMPLETED_EVENT`,
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
