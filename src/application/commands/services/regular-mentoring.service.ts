import { Inject, Injectable, Logger } from '@nestjs/common';
import { CalendarService } from '@core/calendar';
import {
  UserType,
  SessionType as CalendarSessionType,
} from '@core/calendar/interfaces/calendar-slot.interface';
import { MeetingProviderType } from '@core/meeting';
import { RegularMentoringDomainService } from '@domains/services/sessions/regular-mentoring/services/regular-mentoring-domain.service';
import { RegularMentoringQueryService } from '@domains/query/services/regular-mentoring-query.service';
import { SessionType } from '@domains/services/sessions/shared/enums/session-type.enum';
import { ServiceHoldService } from '@domains/contract/services/service-hold.service';
import { StudentCounselorService } from '@domains/identity/student/student-counselor.service';
import { TimeConflictException, NotFoundException } from '@shared/exceptions';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type {
  DrizzleDatabase,
  DrizzleTransaction,
} from '@shared/types/database.types';
import { Trace, addSpanAttributes, addSpanEvent } from '@shared/decorators/trace.decorator';
import { MetricsService } from '@telemetry/metrics.service';
import {
  IntegrationEventPublisher,
  RegularMentoringSessionCancelledEvent,
  RegularMentoringSessionCreatedEvent,
  RegularMentoringSessionUpdatedEvent,
} from '@application/events';

// DTOs
export interface CreateRegularMentoringDto {
  counselorId: string;
  studentId: string;
  mentorId: string; // Simplified from mentorUserId for consistency with studentId
  sessionTypeId: string;
  serviceType?: string; // Business-level service type (e.g., premium_mentoring)
  title: string;
  description?: string;
  scheduledAt: Date;
  duration?: number; // Duration in minutes (default: 60)
  meetingProvider?: string;
}

export interface UpdateRegularMentoringDto {
  title?: string;
  description?: string;
  scheduledAt?: Date;
  duration?: number; // Duration in minutes
}

/**
 * Application Layer - Regular Mentoring Service
 *
 * Responsibility:
 * - Orchestrate the complete flow of creating, updating, canceling, and deleting regular mentoring sessions
 * - Coordinate between Domain Services and Core Services (Calendar, Meeting)
 * - Handle transaction management
 * - Implement business logic for complex operations (create)
 *
 * Dependencies:
 * - DomainRegularMentoringService: Domain layer service for session management
 * - CalendarService: Core service for calendar management
 * - MeetingManagerService: Core service for meeting creation
 * - ServiceHoldService: Domain service for service hold management
 */
@Injectable()
export class RegularMentoringService {
  private readonly logger = new Logger(RegularMentoringService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainRegularMentoringService: RegularMentoringDomainService,
    private readonly regularMentoringQueryService: RegularMentoringQueryService,
    private readonly calendarService: CalendarService,
    private readonly eventPublisher: IntegrationEventPublisher,
    private readonly serviceHoldService: ServiceHoldService,
    private readonly metricsService: MetricsService,
    private readonly studentCounselorService: StudentCounselorService,
  ) {}

  /**
   * Create a new regular mentoring session
   * This is a complex orchestration involving meeting creation, calendar reservation, and session registration
   *
   * @param dto Create session input
   * @returns Created session
   */
  @Trace({
    name: 'regular_mentoring.create',
    attributes: { 'operation.type': 'create' },
  })
  async createSession(dto: CreateRegularMentoringDto) {
    const startTime = Date.now();

    this.logger.log(
      `Creating regular mentoring session: studentId=${dto.studentId}, mentorId=${dto.mentorId}`,
    );

    addSpanAttributes({
      'student.id': dto.studentId,
      'mentor.id': dto.mentorId,
      'counselor.id': dto.counselorId,
      'session.type': 'regular_mentoring',
      'meeting.provider': dto.meetingProvider || 'feishu',
    });

    try {
      addSpanEvent('session.creation.start');

      

      // Convert Date to ISO string for API requirements
      const scheduledAtIso = dto.scheduledAt instanceof Date 
        ? dto.scheduledAt.toISOString() 
        : dto.scheduledAt;

      // Synchronous flow: Create calendar slots and session record only (no meeting creation)
      // Meeting creation is handled asynchronously by RegularMentoringCreatedEventHandler
      const sessionResult = await this.db.transaction(async (tx: DrizzleTransaction) => {
        this.logger.debug('Starting database transaction for session creation');

        // Step 0: Create service hold (reserve service credits)
        const hold = await this.serviceHoldService.createHold(
          {
            studentId: dto.studentId,
            serviceType: dto.serviceType,
            quantity: parseFloat((dto.duration/60).toFixed(1)),
            createdBy: dto.counselorId,
          },
          tx,
        );
        this.logger.debug(`Service hold created: ${hold.id}`);

        // Calculate duration with default value
        const durationMinutes = dto.duration || 60; // Default 1 hour

        // Step 1: Create calendar slots for both mentor and student
        const mentorCalendarSlot = await this.calendarService.createSlotDirect(
          {
            userId: dto.mentorId,
            userType: UserType.MENTOR,
            startTime: scheduledAtIso,
            durationMinutes: durationMinutes,
            sessionType: CalendarSessionType.REGULAR_MENTORING,
            title: dto.title,
            sessionId: undefined, // Will be filled in async flow
          },
          tx,
        );

        if (!mentorCalendarSlot) {
          throw new TimeConflictException('The mentor already has a scheduling conflict');
        }

        this.logger.debug(`Mentor calendar slot created: ${mentorCalendarSlot.id}`);

        const studentCalendarSlot = await this.calendarService.createSlotDirect(
          {
            userId: dto.studentId,
            userType: UserType.STUDENT,
            startTime: scheduledAtIso,
            durationMinutes: durationMinutes,
            sessionType: CalendarSessionType.REGULAR_MENTORING,
            title: dto.title,
            sessionId: undefined, // Will be filled in async flow
          },
          tx,
        );

        if (!studentCalendarSlot) {
          throw new TimeConflictException('The student already has a scheduling conflict');
        }

        this.logger.debug(`Student calendar slot created: ${studentCalendarSlot.id}`);

        // Step 2: Create session record in domain layer (without meeting_id, status=PENDING_MEETING)
        // Note: Need to generate UUID for session ID
        const { randomUUID } = await import('crypto');
        const sessionId = randomUUID();
        
        const session = await this.domainRegularMentoringService.createSession(
          {
            id: sessionId,
            sessionType: SessionType.REGULAR_MENTORING,
            sessionTypeId: dto.sessionTypeId,
            serviceType: dto.serviceType, // Pass serviceType to domain layer
            serviceHoldId: hold.id, // Link to service hold
            studentUserId: dto.studentId,
            mentorUserId: dto.mentorId,
            createdByCounselorId: dto.counselorId,
            title: dto.title,
            description: dto.description,
            scheduledAt: new Date(scheduledAtIso),
          },
          tx,
        );

        this.logger.debug(`Regular mentoring session created: sessionId=${session.getId()}`);

        return {
          sessionId: session.getId(),
          status: session.getStatus(), // PENDING_MEETING
          scheduledAt: session.getScheduledAt(),
          mentorCalendarSlotId: mentorCalendarSlot.id,
          studentCalendarSlotId: studentCalendarSlot.id,
        };
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Regular mentoring session created successfully in ${duration}ms`);
      addSpanEvent('session.creation.success');

      // Publish event to trigger async meeting creation (outside transaction)
      await this.eventPublisher.publish(
        new RegularMentoringSessionCreatedEvent({
          sessionId: sessionResult.sessionId,
          studentId: dto.studentId,
          mentorId: dto.mentorId,
          counselorId: dto.counselorId,
          scheduledStartTime: scheduledAtIso,
          duration: dto.duration || 60,
          meetingProvider: dto.meetingProvider || 'feishu',
          topic: dto.title,
          mentorCalendarSlotId: sessionResult.mentorCalendarSlotId,
          studentCalendarSlotId: sessionResult.studentCalendarSlotId,
        }),
        RegularMentoringService.name,
      );

      this.logger.log(`Published REGULAR_MENTORING_SESSION_CREATED_EVENT for session ${sessionResult.sessionId}`);

      return {
        sessionId: sessionResult.sessionId,
        status: sessionResult.status,
        scheduledAt: sessionResult.scheduledAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create regular mentoring session: ${error.message}`,
        error.stack,
      );
      addSpanEvent('session.creation.error');
      throw error;
    }
  }

  /**
   * Update an existing regular mentoring session
   * Handles two scenarios:
   * 1. Time change: Delete old calendar slots, create new ones, emit update event
   * 2. Metadata only: Update calendar title/session details, emit notification event
   *
   * @param sessionId Session ID
   * @param dto Update data (title, description, scheduledAt)
   * @returns Updated session
   */
  @Trace({
    name: 'regular_mentoring.update',
    attributes: { 'operation.type': 'update' },
  })
  async updateSession(sessionId: string, dto: UpdateRegularMentoringDto) {
    this.logger.log(`Updating regular mentoring session: sessionId=${sessionId}`);

    addSpanAttributes({
      'session.id': sessionId,
      'update.fields': Object.keys(dto).join(','),
    });

    try {
      // Step 1: Fetch old session data for comparison
      const oldSession = await this.regularMentoringQueryService.getSessionById(sessionId);
      if (!oldSession) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      // Step 2: Convert Date to ISO string if provided
      const scheduledAtIso = dto.scheduledAt 
        ? (dto.scheduledAt instanceof Date 
            ? dto.scheduledAt.toISOString() 
            : dto.scheduledAt)
        : undefined;

      // Step 3: Determine if time/duration changed (affects meeting update)
      const oldSessionData = oldSession as any;
      const meetingScheduleStartTime = oldSessionData.scheduleStartTime;
      
      // Validate that meeting schedule start time exists (strict data integrity check)
      if (!meetingScheduleStartTime) {
        throw new Error(`Unable to determine meeting schedule start time for session ${sessionId}: missing scheduleStartTime in database`);
      }
      
      const timeChanged = scheduledAtIso !== meetingScheduleStartTime;
      
      // Check if duration changed (compare against meetings.schedule_duration for consistency)
      // Use meetings table schedule_duration as source of truth for actual meeting duration
      // If duration not provided by counselor, use the existing meeting duration
      const meetingScheduleDuration = oldSessionData.duration;
      const newDuration = dto.duration ?? meetingScheduleDuration;
      
      // Validate that duration is available (either from request or database)
      if (!newDuration) {
        throw new Error(`Unable to determine duration for session ${sessionId}: missing duration in both request and database`);
      }
      
      const durationChanged = newDuration !== meetingScheduleDuration;
      
      // Step 5: Execute transaction to update calendar and session
      const updatedSession = await this.db.transaction(async (tx: DrizzleTransaction) => {

        // Update service hold when time/duration changes (rescheduling consumes credits)
        // if (durationChanged) {
        //   const oldHoldId = (oldSession as any).serviceHoldId;
        //   if (oldHoldId) {
        //     await this.serviceHoldService.updateHold(
        //       oldHoldId,
        //       {
        //         studentId: oldSession.studentUserId,
        //         serviceType: oldSession.serviceType,
        //         quantity: parseFloat((dto.duration/60).toFixed(1)),
        //       },
        //       tx,
        //     );
        //     this.logger.debug(`Service hold updated for rescheduling: ${oldHoldId}`);
        //   }
        // }

        // Update calendar if either scheduled time or duration changed
        if (timeChanged || durationChanged) {
          // Cancel old calendar slots (update status to 'cancelled' instead of deleting)
          // Preserves audit trail and maintains business flow history
          await this.calendarService.updateSlots(
            sessionId,
            { status: 'cancelled' as any },
            tx,
          );
          this.logger.debug(`Old calendar slots cancelled for session ${sessionId}`);

          // Create new calendar slots with new time and duration (triggers EXCLUDE constraint check)
          const mentorSlot = await this.calendarService.createSlotDirect(
            {
              userId: oldSession.mentorUserId,
              userType: UserType.MENTOR,
              startTime: scheduledAtIso,
              durationMinutes: newDuration,
              sessionType: CalendarSessionType.REGULAR_MENTORING,
              title: dto.title || oldSession.title,
              sessionId: sessionId,
            },
            tx,
          );

          if (!mentorSlot) {
            throw new TimeConflictException('The mentor already has a scheduling conflict');
          }

          const studentSlot = await this.calendarService.createSlotDirect(
            {
              userId: oldSession.studentUserId,
              userType: UserType.STUDENT,
              startTime: scheduledAtIso,
              durationMinutes: newDuration,
              sessionType: CalendarSessionType.REGULAR_MENTORING,
              title: dto.title || oldSession.title,
              sessionId: sessionId,
            },
            tx,
          );

          if (!studentSlot) {
            throw new TimeConflictException('The student already has a scheduling conflict');
          }

          this.logger.debug(`New calendar slots created for session ${sessionId}`);
        } else {
          // Only metadata changed (title or description), update calendar title if provided
          if (dto.title) {
            await this.calendarService.updateSlots(
              sessionId,
              { title: dto.title },
              tx,
            );
            this.logger.debug(`Calendar slot title updated for session ${sessionId}`);
          }
        }

        // Update session record (title, description, scheduledAt do not change status)
        const updated = await this.domainRegularMentoringService.updateSession(
          sessionId,
          {
            title: dto.title,
            description: dto.description,
            scheduledAt: scheduledAtIso ? new Date(scheduledAtIso) : undefined,
          },
          tx,
        );

        return updated;
      });

      this.logger.log(`Regular mentoring session updated: sessionId=${sessionId}`);
      addSpanEvent('session.update.success');

      // Step 6: Extract meeting provider from oldSession
      const meetingProvider = oldSessionData.meetingProvider || 'feishu';

      // Step 7: Emit event to trigger async meeting update (only when time or duration changes)
      if (timeChanged || durationChanged) {
        await this.eventPublisher.publish(
          new RegularMentoringSessionUpdatedEvent({
            sessionId: sessionId,
            meetingId: oldSession.meetingId,
            oldScheduledAt: meetingScheduleStartTime,
            newScheduledAt: scheduledAtIso,
            oldDuration: meetingScheduleDuration,
            newDuration: newDuration,
            newTitle: dto.title || oldSession.title,
            mentorId: oldSession.mentorUserId,
            studentId: oldSession.studentUserId,
            counselorId: oldSession.createdByCounselorId,
            meetingProvider: meetingProvider,
          }),
          RegularMentoringService.name,
        );
        this.logger.log(`Published REGULAR_MENTORING_SESSION_UPDATED_EVENT for session ${sessionId}`);
      }

      // Construct response with all updated values including meeting info
      // Meeting URL does not change when rescheduling, so include it from oldSession
      return {
        ...updatedSession,
        title: dto.title || updatedSession.getTitle(),
        description: dto.description !== undefined ? dto.description : updatedSession.getDescription(),
        scheduledAt: scheduledAtIso || updatedSession.getScheduledAt(),
        duration: newDuration, // Use the newly calculated duration
        // Include complete meeting object for mapper to extract all meeting-related fields
        meeting: oldSession.meeting,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update regular mentoring session: ${error.message}`,
        error.stack,
      );
      addSpanEvent('session.update.error');
      throw error;
    }
  }

  /**
   * Cancel a regular mentoring session
   * Synchronous flow (transaction): Update session + Release calendar slots
   * Asynchronous flow (event): Cancel meeting via third-party API
   *
   * @param sessionId Session ID
   * @param reason Cancellation reason
   * @returns Cancelled session with CANCELLED status
   */
  @Trace({
    name: 'regular_mentoring.cancel',
    attributes: { 'operation.type': 'cancel' },
  })
  async cancelSession(sessionId: string, reason: string) {
    this.logger.log(`Canceling regular mentoring session: sessionId=${sessionId}`);

    addSpanAttributes({
      'session.id': sessionId,
      'cancellation.reason': reason,
    });

    try {
      // Step 1: Fetch session details before cancellation
      const session = await this.regularMentoringQueryService.getSessionById(sessionId);
      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      // Step 2: Validate session status (only scheduled/pending_meeting can be cancelled)
      const statusLower = session.status?.toLowerCase();
      if (!['scheduled', 'pending_meeting'].includes(statusLower)) {
        throw new Error(`Cannot cancel session with status: ${session.status}`);
      }

      // Step 3: Execute transaction to update session and calendar
      await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Release service hold when session is cancelled
        await this.serviceHoldService.releaseHold(session.serviceHoldId, reason);

        // Update session status to CANCELLED
        await this.domainRegularMentoringService.cancelSession(sessionId, reason, tx);

        // Release calendar slots (update status to cancelled instead of deleting)
        await this.calendarService.updateSlots(
          sessionId,
          { status: 'cancelled' as any },
          tx,
        );
        this.logger.debug(`Calendar slots cancelled for session ${sessionId}`);
      });

      // Step 4: Re-fetch session to get updated data with cancelledAt
      const cancelledSession = await this.regularMentoringQueryService.getSessionById(sessionId);

      this.logger.log(`Regular mentoring session cancelled in transaction: sessionId=${sessionId}`);
      addSpanEvent('session.cancel.transaction.success');

      // Step 5: Extract meeting provider and session details
      const sessionData = session as any;
      const meetingProvider = sessionData.meetingProvider || 'feishu';

      // Step 6: Publish cancellation event for async meeting cancellation
      await this.eventPublisher.publish(
        new RegularMentoringSessionCancelledEvent({
          sessionId: sessionId,
          meetingId: session.meetingId,
          studentId: session.studentUserId,
          mentorId: session.mentorUserId,
          counselorId: session.createdByCounselorId,
          scheduledAt: session.scheduledAt,
          cancelReason: reason,
          cancelledAt: (cancelledSession as any).cancelledAt,
          meetingProvider: meetingProvider,
        }),
        RegularMentoringService.name,
      );

      this.logger.log(`Published REGULAR_MENTORING_SESSION_CANCELLED_EVENT for session ${sessionId}`);
      addSpanEvent('session.cancel.success');

      // Step 7: Return cancelled session with meeting info (similar to updateSession)
      return {
        ...cancelledSession,
        meeting: session.meeting,
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel regular mentoring session: ${error.message}`,
        error.stack,
      );
      addSpanEvent('session.cancel.error');
      throw error;
    }
  }

  /**
   * Delete (soft delete) a regular mentoring session
   *
   * @param sessionId Session ID
   * @returns Deletion result
   */
  @Trace({
    name: 'regular_mentoring.delete',
    attributes: { 'operation.type': 'delete' },
  })
  async deleteSession(sessionId: string) {
    this.logger.log(`Deleting regular mentoring session: sessionId=${sessionId}`);

    addSpanAttributes({
      'session.id': sessionId,
    });

    try {
      // Get session details before deletion
      const session = await this.regularMentoringQueryService.getSessionById(sessionId);
      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      // Soft delete in domain layer
      await this.domainRegularMentoringService.deleteSession(sessionId);

      this.logger.log(`Regular mentoring session deleted: sessionId=${sessionId}`);
      addSpanEvent('session.delete.success');

      return { sessionId, status: 'deleted' };
    } catch (error) {
      this.logger.error(
        `Failed to delete regular mentoring session: ${error.message}`,
        error.stack,
      );
      addSpanEvent('session.delete.error');
      throw error;
    }
  }

  /**
   * Get session details by ID
   *
   * @param sessionId Session ID
   * @returns Session details
   */
  async getSessionById(sessionId: string) {
    this.logger.debug(`Fetching session details: sessionId=${sessionId}`);

    const session = await this.regularMentoringQueryService.getSessionById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    return session;
  }

  /**
   * Get sessions list for a counselor
   *
   * @param counselorId Counselor ID
   * @param filters Query filters
   * @returns List of sessions
   */
  async getSessionsByCreator(counselorId: string, filters?: any) {
    this.logger.debug(`Fetching sessions created by counselor: counselorId=${counselorId}`);

    return this.regularMentoringQueryService.getMentorSessions(counselorId, {
      ...filters,
      createdByCounselor: true,
    });
  }

  /**
   * Get sessions list for a mentor
   *
   * @param mentorId Mentor ID
   * @param filters Query filters
   * @returns List of sessions
   */
  async getSessionsByMentor(mentorId: string, filters?: any) {
    this.logger.debug(`Fetching sessions for mentor: mentorId=${mentorId}`);

    return this.regularMentoringQueryService.getMentorSessions(mentorId, filters);
  }

  /**
   * Get sessions list for a student
   *
   * @param studentId Student ID
   * @param filters Query filters
   * @returns List of sessions
   */
  async getSessionsByStudent(studentId: string, filters?: any) {
    this.logger.debug(`Fetching sessions for student: studentId=${studentId}`);

    return this.regularMentoringQueryService.getStudentSessions(studentId, filters);
  }

  /**
   * Get sessions based on user role and optional filters
   * Supports flexible parameter combinations:
   * - studentId: Query specific student's sessions
   * - mentorId: Query specific mentor's sessions
   * - If both provided: Query sessions for that student-mentor combination
   * - If neither provided: Route based on role to get default data
   *
   * @param userId User ID (counselor, mentor, or student)
   * @param role User role (counselor, mentor, or student)
   * @param filters Optional filters (can include studentId, mentorId, counselorId, etc.)
   * @returns List of sessions
   */
  async getSessionsByRole(userId: string, role: string, filters?: any) {
    const { studentId, mentorId } = filters || {};

    this.logger.debug(
      `Fetching sessions by role: userId=${userId}, role=${role}, studentId=${studentId || 'N/A'}, mentorId=${mentorId || 'N/A'}`,
    );

    // Step 1: If specific studentId is provided, query that student's sessions
    if (studentId) {
      this.logger.debug(`Querying by studentId: ${studentId}`);
      return this.regularMentoringQueryService.getStudentSessions(studentId, filters);
    }

    // Step 2: If specific mentorId is provided, query that mentor's sessions
    if (mentorId) {
      this.logger.debug(`Querying by mentorId: ${mentorId}`);
      return this.getSessionsByMentor(mentorId, filters);
    }

    // Step 3: Otherwise, route based on role to get default data
    this.logger.debug(`Routing by role: ${role}`);
    switch (role) {
      case 'counselor':
        return this.getSessionsByCounselor(userId, filters);

      case 'mentor':
        return this.getSessionsByMentor(userId, filters);

      case 'student':
        return this.getSessionsByStudent(userId, filters);

      default:
        this.logger.warn(`Unknown role: ${role}`);
        return [];
    }
  }

  /**
   * Get all sessions for a counselor's students
   * Fetches list of students associated with the counselor,
   * then retrieves all their sessions
   *
   * @param counselorId Counselor ID
   * @param filters Query filters
   * @returns List of sessions for all counselor's students
   */
  private async getSessionsByCounselor(counselorId: string, filters?: any) {
    this.logger.debug(`Fetching all sessions for counselor: counselorId=${counselorId}`);

    // Step 1: Get all student IDs for this counselor
    const studentIds = await this.studentCounselorService.getStudentIdsByCounselor(counselorId);

    this.logger.debug(`Counselor ${counselorId} has ${studentIds.length} students`);

    // Step 2: If no students, return empty array
    if (studentIds.length === 0) {
      return [];
    }

    // Step 3: Query sessions for all students
    return this.regularMentoringQueryService.getSessionsByStudentIds(studentIds, filters || {});
  }
}
