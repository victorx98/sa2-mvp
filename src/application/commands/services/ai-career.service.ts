import { Inject, Injectable, Logger } from '@nestjs/common';
import { CalendarService } from '@core/calendar';
import {
  UserType,
  SessionType as CalendarSessionType,
} from '@core/calendar/interfaces/calendar-slot.interface';
import { MeetingProviderType } from '@core/meeting';
import { AiCareerDomainService } from '@domains/services/sessions/ai-career/services/ai-career-domain.service';
import { AiCareerQueryService } from '@domains/query/services/ai-career-query.service';
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
  AiCareerSessionCancelledEvent,
  AiCareerSessionCreatedEvent,
  AiCareerSessionUpdatedEvent,
  IntegrationEventPublisher,
} from '@application/events';

// DTOs
export interface CreateAiCareerDto {
  counselorId: string;
  studentId: string;
  mentorId: string;
  sessionTypeId: string;
  serviceType?: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  duration?: number;
  meetingProvider?: string;
}

export interface UpdateAiCareerDto {
  title?: string;
  description?: string;
  scheduledAt?: Date;
  duration?: number; // NEW: Added duration field
}

/**
 * Application Layer - AI Career Service
 *
 * Responsibility:
 * - Orchestrate the complete flow of creating, updating, canceling, and deleting AI career sessions
 * - Coordinate between Domain Services and Core Services (Calendar, Meeting)
 * - Handle transaction management
 * - Implement business logic for complex operations (create)
 */
@Injectable()
export class AiCareerService {
  private readonly logger = new Logger(AiCareerService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainAiCareerService: AiCareerDomainService,
    private readonly aiCareerQueryService: AiCareerQueryService,
    private readonly calendarService: CalendarService,
    private readonly eventPublisher: IntegrationEventPublisher,
    private readonly serviceHoldService: ServiceHoldService,
    private readonly metricsService: MetricsService,
    private readonly studentCounselorService: StudentCounselorService,
  ) {}

  /**
   * Create a new AI career session asynchronously
   * Returns immediately with PENDING_MEETING status
   * Meeting creation happens asynchronously via event handler
   *
   * @param dto Create session input
   * @returns Created session details with PENDING_MEETING status
   */
  @Trace({
    name: 'ai_career.create',
    attributes: { 'operation.type': 'create' },
  })
  async createSession(dto: CreateAiCareerDto) {
    const startTime = Date.now();

    this.logger.log(
      `Creating AI career session: studentId=${dto.studentId}, mentorId=${dto.mentorId}`,
    );

    addSpanAttributes({
      'student.id': dto.studentId,
      'mentor.id': dto.mentorId,
      'counselor.id': dto.counselorId,
      'session.type': 'ai_career',
      'meeting.provider': dto.meetingProvider || 'feishu',
    });

    try {
      addSpanEvent('session.creation.start');

      // Convert Date to ISO string for API requirements
      const scheduledAtIso = dto.scheduledAt instanceof Date
        ? dto.scheduledAt.toISOString()
        : dto.scheduledAt;

      // Synchronous flow: Create calendar slots and session record only (no meeting creation)
      // Meeting creation is handled asynchronously by AiCareerCreatedEventHandler
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
        const durationMinutes = dto.duration || 60;

        // Step 1: Create calendar slots for both mentor and student
        const mentorCalendarSlot = await this.calendarService.createSlotDirect(
          {
            userId: dto.mentorId,
            userType: UserType.MENTOR,
            startTime: scheduledAtIso,
            durationMinutes: durationMinutes,
            sessionType: CalendarSessionType.AI_CAREER,
            title: dto.title,
            sessionId: undefined,
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
            sessionType: CalendarSessionType.AI_CAREER,
            title: dto.title,
            sessionId: undefined,
          },
          tx,
        );

        if (!studentCalendarSlot) {
          throw new TimeConflictException('The student already has a scheduling conflict');
        }

        this.logger.debug(`Student calendar slot created: ${studentCalendarSlot.id}`);

        // Step 2: Create session record in domain layer (without meeting_id, status=PENDING_MEETING)
        const { randomUUID } = await import('crypto');
        const sessionId = randomUUID();
        
        const session = await this.domainAiCareerService.createSession(
          {
            id: sessionId,
            sessionType: SessionType.AI_CAREER,
            sessionTypeId: dto.sessionTypeId,
            serviceType: dto.serviceType,
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

        this.logger.debug(`AI career session created: sessionId=${session.getId()}`);

        return {
          sessionId: session.getId(),
          status: session.getStatus(),
          scheduledAt: session.getScheduledAt(),
          mentorCalendarSlotId: mentorCalendarSlot.id,
          studentCalendarSlotId: studentCalendarSlot.id,
        };
      });

      const duration = Date.now() - startTime;
      this.logger.log(`AI career session created successfully in ${duration}ms`);
      addSpanEvent('session.creation.success');

      // Publish event to trigger async meeting creation (outside transaction)
      await this.eventPublisher.publish(
        new AiCareerSessionCreatedEvent({
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
        AiCareerService.name,
      );

      this.logger.log(`Published AI_CAREER_SESSION_CREATED_EVENT for session ${sessionResult.sessionId}`);

      return {
        sessionId: sessionResult.sessionId,
        status: sessionResult.status,
        scheduledAt: sessionResult.scheduledAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create AI career session: ${error.message}`,
        error.stack,
      );
      addSpanEvent('session.creation.error');
      throw error;
    }
  }

  /**
   * Update an existing AI career session
   * Handles time/duration changes with calendar updates and async meeting updates
   *
   * @param sessionId Session ID
   * @param dto Update data (title, description, scheduledAt, duration)
   * @returns Updated session with all new values
   */
  @Trace({
    name: 'ai_career.update',
    attributes: { 'operation.type': 'update' },
  })
  async updateSession(sessionId: string, dto: UpdateAiCareerDto) {
    this.logger.log(`Updating AI career session: sessionId=${sessionId}`);

    addSpanAttributes({
      'session.id': sessionId,
      'update.fields': Object.keys(dto).join(','),
    });

    try {
      addSpanEvent('session.update.start');

      // Convert Date to ISO string if provided
      const scheduledAtIso = dto.scheduledAt
        ? (dto.scheduledAt instanceof Date
          ? dto.scheduledAt.toISOString()
          : dto.scheduledAt)
        : undefined;

      // Step 1: Fetch old session with meeting details (LEFT JOIN)
      const oldSession = await this.aiCareerQueryService.getSessionById(sessionId);
      if (!oldSession) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      const oldSessionData = oldSession as any;

      // Step 2: Determine if time or duration changed
      const meetingScheduleStartTime = oldSessionData.scheduleStartTime;
      
      // Validate meeting schedule start time exists (strict data integrity)
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

      // Step 3: Transaction - Update calendar and session
      const updatedSession = await this.db.transaction(async (tx: DrizzleTransaction) => {

        // Update service hold when duration changes (rescheduling consumes credits)
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

        if (timeChanged || durationChanged) {
          // Cancel old calendar slots (update status to 'cancelled' instead of deleting)
          await this.calendarService.updateSlots(
            sessionId,
            { status: 'cancelled' as any },
            tx,
          );
          this.logger.debug(`Old calendar slots cancelled for session ${sessionId}`);

          // Create new calendar slots with new time and duration
          const mentorSlot = await this.calendarService.createSlotDirect(
            {
              userId: oldSession.mentorUserId,
              userType: UserType.MENTOR,
              startTime: scheduledAtIso,
              durationMinutes: newDuration,
              sessionType: CalendarSessionType.AI_CAREER,
              title: dto.title || oldSession.title,
              sessionId: sessionId,
              meetingId: oldSession.meetingId,
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
              sessionType: CalendarSessionType.AI_CAREER,
              title: dto.title || oldSession.title,
              sessionId: sessionId,
              meetingId: oldSession.meetingId,
            },
            tx,
          );

          if (!studentSlot) {
            throw new TimeConflictException('The student already has a scheduling conflict');
          }

          this.logger.debug(`New calendar slots created for session ${sessionId}`);
        } else {
          // Only metadata changed (title or description)
          if (dto.title) {
            await this.calendarService.updateSlots(
              sessionId,
              { title: dto.title },
              tx,
            );
            this.logger.debug(`Calendar slot title updated for session ${sessionId}`);
          }
        }

        // Update session record
        const updateResult = await this.domainAiCareerService.updateSession(
          sessionId,
          {
            title: dto.title,
            description: dto.description,
            scheduledAt: scheduledAtIso ? new Date(scheduledAtIso) : undefined,
          },
          tx,
        );

        return updateResult;
      });

      this.logger.log(`AI career session updated: sessionId=${sessionId}`);
      addSpanEvent('session.update.success');

      // Step 4: Extract meeting provider from oldSession
      const meetingProvider = oldSessionData.meetingProvider || 'feishu';

      // Step 5: Emit event to trigger async meeting update (only when time or duration changes)
      if (timeChanged || durationChanged) {
        await this.eventPublisher.publish(
          new AiCareerSessionUpdatedEvent({
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
          AiCareerService.name,
        );
        this.logger.log(`Published AI_CAREER_SESSION_UPDATED_EVENT for session ${sessionId}`);
      }

      // Step 6: Construct response with all updated values including meeting info
      return {
        ...updatedSession,
        title: dto.title || updatedSession.getTitle(),
        description: dto.description !== undefined ? dto.description : updatedSession.getDescription(),
        scheduledAt: scheduledAtIso || updatedSession.getScheduledAt(),
        duration: newDuration,
        // Include complete meeting object for mapper
        meeting: oldSession.meeting,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update AI career session: ${error.message}`,
        error.stack,
      );
      addSpanEvent('session.update.error');
      throw error;
    }
  }

  /**
   * Cancel an AI career session
   * Synchronous flow (transaction): Update session + Release calendar slots
   * Asynchronous flow (event): Cancel meeting via third-party API
   *
   * @param sessionId Session ID
   * @param reason Cancellation reason
   * @returns Cancelled session with CANCELLED status
   */
  @Trace({
    name: 'ai_career.cancel',
    attributes: { 'operation.type': 'cancel' },
  })
  async cancelSession(sessionId: string, reason: string) {
    this.logger.log(`Canceling AI career session: sessionId=${sessionId}`);

    addSpanAttributes({
      'session.id': sessionId,
      'cancellation.reason': reason,
    });

    try {
      // Step 1: Fetch session details before cancellation
      const session = await this.aiCareerQueryService.getSessionById(sessionId);
      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      // Step 2: Validate session status (only scheduled/pending_meeting can be cancelled)
      const statusLower = session.status?.toLowerCase();
      if (!['scheduled', 'pending_meeting', 'meeting_failed'].includes(statusLower)) {
        throw new Error(`Cannot cancel session with status: ${session.status}`);
      }

      // Step 3: Execute transaction to update session and calendar
      await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Release service hold when session is cancelled
        await this.serviceHoldService.releaseHold(session.serviceHoldId, reason);

        // Update session status to CANCELLED
        await this.domainAiCareerService.cancelSession(sessionId, tx);

        // Release calendar slots (update status to cancelled)
        await this.calendarService.updateSlots(
          sessionId,
          { status: 'cancelled' as any },
          tx,
        );
        this.logger.debug(`Calendar slots cancelled for session ${sessionId}`);
      });

      // Step 4: Re-fetch session to get updated data with cancelledAt
      const cancelledSession = await this.aiCareerQueryService.getSessionById(sessionId);

      this.logger.log(`AI career session cancelled in transaction: sessionId=${sessionId}`);
      addSpanEvent('session.cancel.transaction.success');

      // Step 5: Extract meeting provider and session details
      const sessionData = session as any;
      const meetingProvider = sessionData.meetingProvider || 'feishu';

      // Step 6: Publish cancellation event for async meeting cancellation
      await this.eventPublisher.publish(
        new AiCareerSessionCancelledEvent({
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
        AiCareerService.name,
      );

      this.logger.log(`Published AI_CAREER_SESSION_CANCELLED_EVENT for session ${sessionId}`);
      addSpanEvent('session.cancel.success');

      // Step 7: Return cancelled session with meeting info (similar to updateSession)
      return {
        ...cancelledSession,
        meeting: session.meeting,
      };
    } catch (error) {
      this.logger.error(
        `Failed to cancel AI career session: ${error.message}`,
        error.stack,
      );
      addSpanEvent('session.cancel.error');
      throw error;
    }
  }

  /**
   * Delete (soft delete) an AI career session
   *
   * @param sessionId Session ID
   * @returns Deletion result
   */
  @Trace({
    name: 'ai_career.delete',
    attributes: { 'operation.type': 'delete' },
  })
  async deleteSession(sessionId: string) {
    this.logger.log(`Deleting AI career session: sessionId=${sessionId}`);

    addSpanAttributes({
      'session.id': sessionId,
    });

    try {
      // Get session details before deletion
      const session = await this.aiCareerQueryService.getSessionById(sessionId);
      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      // Soft delete in domain layer
      await this.domainAiCareerService.deleteSession(sessionId);

      this.logger.log(`AI career session deleted: sessionId=${sessionId}`);
      addSpanEvent('session.delete.success');

      return { sessionId, status: 'deleted' };
    } catch (error) {
      this.logger.error(
        `Failed to delete AI career session: ${error.message}`,
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

    const session = await this.aiCareerQueryService.getSessionById(sessionId);
    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    return session;
  }

  /**
   * Get sessions by role with flexible filtering
   * Supports querying by studentId, mentorId, or role-based default
   *
   * @param userId Current user ID
   * @param role User role (counselor, mentor, student)
   * @param filters Query filters including optional studentId, mentorId
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
      return this.aiCareerQueryService.getStudentSessions(studentId, filters);
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
        return this.getSessionsByCreator(userId, filters);

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
   * then retrieves all their AI career sessions
   *
   * @param counselorId Counselor ID
   * @param filters Query filters
   * @returns List of sessions for all counselor's students
   */
  async getSessionsByCreator(counselorId: string, filters?: any) {
    this.logger.debug(`Fetching all sessions for counselor: counselorId=${counselorId}`);

    // Step 1: Get all student IDs for this counselor
    const studentIds = await this.studentCounselorService.getStudentIdsByCounselor(counselorId);

    this.logger.debug(`Counselor ${counselorId} has ${studentIds.length} students`);

    // Step 2: If no students, return empty array
    if (studentIds.length === 0) {
      return [];
    }

    // Step 3: Query sessions for all students
    return this.aiCareerQueryService.getSessionsByStudentIds(studentIds, filters || {});
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

    return this.aiCareerQueryService.getMentorSessions(mentorId, filters);
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

    return this.aiCareerQueryService.getStudentSessions(studentId, filters);
  }
}
