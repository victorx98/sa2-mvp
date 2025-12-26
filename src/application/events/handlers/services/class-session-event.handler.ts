import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MeetingManagerService } from '@core/meeting';
import {
  ClassSessionCancelledEvent,
  ClassSessionMeetingOperationResultEvent,
  ClassSessionUpdatedEvent,
  HandlesEvent,
  IntegrationEventPublisher,
} from '@application/events';
import { retryWithBackoff } from '@shared/utils/retry.util';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { ClassSessionDomainService } from '@domains/services/class/class-sessions/services/class-session-domain.service';
import { sql } from 'drizzle-orm';

/**
 * Class Session Event Handler
 *
 * Note: session creation provisioning is handled by SessionProvisioningSaga.
 * This handler keeps update/cancel logic for class sessions.
 */
@Injectable()
export class ClassSessionCreatedEventHandler {
  private readonly logger = new Logger(ClassSessionCreatedEventHandler.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly classSessionService: ClassSessionDomainService,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {}

  /**
   * Handle CLASS_SESSION_UPDATED_EVENT
   * Executes async meeting update flow when session is rescheduled
   * 
   * Responsibilities:
   * 1. Update meeting on third-party platform with retry logic
   * 2. Update meetings table with new schedule info
   * 3. Publish MEETING_OPERATION_RESULT_EVENT (operation: update)
   */
  @OnEvent(ClassSessionUpdatedEvent.eventType)
  @HandlesEvent(ClassSessionUpdatedEvent.eventType, ClassSessionCreatedEventHandler.name)
  async handleSessionUpdated(event: ClassSessionUpdatedEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling CLASS_SESSION_UPDATED_EVENT: sessionId=${payload.sessionId}`,
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
                topic: payload.topic,
                startTime: typeof payload.newScheduledStartTime === 'string'
                  ? payload.newScheduledStartTime
                  : payload.newScheduledStartTime.toISOString(),
                duration: payload.newDuration,
              },
            );
          },
          3,
          1000,
          this.logger,
        );

        // Step 3: Update meetings table with new schedule info
        const startTime = new Date(payload.newScheduledStartTime);
        await this.db.execute(sql`
          UPDATE meetings 
          SET 
            topic = ${payload.topic},
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

    // Step 4: Get class students and counselors for calendar updates
    const classStudents = await this.db.query.classStudents.findMany({
      where: (classStudents, { eq }) => eq(classStudents.classId, payload.classId),
    });
    const studentIds = classStudents.map(cs => cs.studentUserId);
    
    const classCounselors = await this.db.query.classCounselors.findMany({
      where: (classCounselors, { eq }) => eq(classCounselors.classId, payload.classId),
    });
    const counselorIds = classCounselors.map(cc => cc.counselorUserId);

    // Step 5: Publish result event based on result
    await this.eventPublisher.publish(
      new ClassSessionMeetingOperationResultEvent({
        operation: 'update',
        status: updateSuccess ? 'success' : 'failed',
        sessionId: payload.sessionId,
        meetingId: payload.meetingId,
        classId: payload.classId,
        mentorId: payload.mentorId,
        counselorIds,
        studentIds,
        newScheduledAt: payload.newScheduledStartTime,
        newDuration: payload.newDuration,
        errorMessage: updateSuccess ? undefined : errorMessage,
        notifyRoles: updateSuccess ? ['counselor', 'mentor'] : ['counselor'],
        requireManualIntervention: !updateSuccess,
      }),
      ClassSessionCreatedEventHandler.name,
    );

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=update, status=${updateSuccess ? 'success' : 'failed'}, sessionId=${payload.sessionId}`,
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
  @OnEvent(ClassSessionCancelledEvent.eventType)
  @HandlesEvent(ClassSessionCancelledEvent.eventType, ClassSessionCreatedEventHandler.name)
  async handleSessionCancelled(event: ClassSessionCancelledEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling CLASS_SESSION_CANCELLED_EVENT: sessionId=${payload.sessionId}`,
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

    // Step 4: Get class students and counselors for calendar cancellation
    const classStudents = await this.db.query.classStudents.findMany({
      where: (classStudents, { eq }) => eq(classStudents.classId, payload.classId),
    });
    const studentIds = classStudents.map(cs => cs.studentUserId);
    
    const classCounselors = await this.db.query.classCounselors.findMany({
      where: (classCounselors, { eq }) => eq(classCounselors.classId, payload.classId),
    });
    const counselorIds = classCounselors.map(cc => cc.counselorUserId);

    // Step 5: Publish result event based on result
    await this.eventPublisher.publish(
      new ClassSessionMeetingOperationResultEvent({
        operation: 'cancel',
        status: cancelSuccess ? 'success' : 'failed',
        sessionId: payload.sessionId,
        meetingId: payload.meetingId,
        classId: payload.classId,
        mentorId: payload.mentorId,
        counselorIds,
        studentIds,
        cancelledAt: payload.cancelledAt,
        cancelReason: payload.cancelReason,
        errorMessage: cancelSuccess ? undefined : errorMessage,
        notifyRoles: cancelSuccess ? ['counselor', 'mentor'] : ['counselor'],
        requireManualIntervention: !cancelSuccess,
      }),
      ClassSessionCreatedEventHandler.name,
    );

    this.logger.log(
      `MEETING_OPERATION_RESULT_EVENT published: operation=cancel, status=${cancelSuccess ? 'success' : 'failed'}, sessionId=${payload.sessionId}`,
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

}
