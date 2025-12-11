import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CalendarService } from '@core/calendar';
import {
  UserType,
  SessionType as CalendarSessionType,
} from '@core/calendar/interfaces/calendar-slot.interface';
import { TimeConflictException, NotFoundException } from '@shared/exceptions';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type {
  DrizzleDatabase,
  DrizzleTransaction,
} from '@shared/types/database.types';
import { Trace, addSpanAttributes, addSpanEvent } from '@shared/decorators/trace.decorator';
import { MetricsService } from '@telemetry/metrics.service';
import { 
  COMM_SESSION_CREATED_EVENT,
  COMM_SESSION_UPDATED_EVENT,
  COMM_SESSION_CANCELLED_EVENT,
  SESSION_RESCHEDULED_COMPLETED,
} from '@shared/events/event-constants';
import { CommSessionService as DomainCommSessionService } from '@domains/services/comm-sessions/services/comm-session.service';
import { CommSessionQueryService as DomainCommSessionQueryService } from '@domains/services/comm-sessions/services/comm-session-query.service';
import { CommSessionStatus, CommSessionType } from '@domains/services/comm-sessions/entities/comm-session.entity';
import { CreateCommSessionDto as DomainCreateCommSessionDto } from '@domains/services/comm-sessions/dto/create-comm-session.dto';
import { UpdateCommSessionDto as DomainUpdateCommSessionDto } from '@domains/services/comm-sessions/dto/update-comm-session.dto';
import { StudentCounselorService } from '@domains/identity/student/student-counselor.service';

// DTOs
export interface CreateCommSessionDto {
  counselorId: string;
  studentId: string;
  mentorId?: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  duration?: number;
  meetingProvider?: string;
}

export interface UpdateCommSessionDto {
  title?: string;
  description?: string;
  scheduledAt?: Date;
  duration?: number; // Duration in minutes
}

/**
 * Application Layer - Communication Session Service
 *
 * Responsibility:
 * - Orchestrate the complete flow of creating, updating, canceling communication sessions
 * - Coordinate between Core Services (Calendar, Meeting)
 * - Handle transaction management
 * - Communicate sessions are NOT billable - no service hold creation required
 */
@Injectable()
export class CommSessionService {
  private readonly logger = new Logger(CommSessionService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainCommSessionService: DomainCommSessionService,
    private readonly domainCommSessionQueryService: DomainCommSessionQueryService,
    private readonly calendarService: CalendarService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
    private readonly studentCounselorService: StudentCounselorService,
  ) {}

  /**
   * Create a new communication session asynchronously
   * Returns immediately with PENDING_MEETING status
   * Meeting creation happens asynchronously via event handler
   *
   * @param dto Create session input
   * @returns Created session details with PENDING_MEETING status
   */
  @Trace({
    name: 'comm_session.create',
    attributes: { 'operation.type': 'create' },
  })
  async createSession(dto: CreateCommSessionDto) {
    const startTime = Date.now();

    this.logger.log(
      `Creating comm session: studentId=${dto.studentId}, counselorId=${dto.counselorId}`,
    );

    addSpanAttributes({
      'student.id': dto.studentId,
      'mentor.id': dto.mentorId,
      'counselor.id': dto.counselorId,
      'session.type': 'comm_session',
      'meeting.provider': dto.meetingProvider || 'feishu',
    });

    try {
      addSpanEvent('session.creation.start');

      const scheduledAtIso = dto.scheduledAt instanceof Date
        ? dto.scheduledAt.toISOString()
        : dto.scheduledAt;

      // Create calendar slots (async meeting creation via event handler)
      const sessionResult = await this.db.transaction(async (tx: DrizzleTransaction) => {
        this.logger.debug('Starting database transaction for session creation');

        const durationMinutes = dto.duration || 60;

        // Create student calendar slot
        const studentCalendarSlot = await this.calendarService.createSlotDirect(
          {
            userId: dto.studentId,
            userType: UserType.STUDENT,
            startTime: scheduledAtIso,
            durationMinutes: durationMinutes,
            sessionType: CalendarSessionType.COMM_SESSION,
            title: dto.title,
            sessionId: undefined,
            metadata: {
              otherPartyName: dto.mentorId ? 'mentorName' : 'counselorName',
            },
          },
          tx,
        );

        if (!studentCalendarSlot) {
          throw new TimeConflictException('The student already has a scheduling conflict');
        }

        this.logger.debug(`Student calendar slot created: ${studentCalendarSlot.id}`);

        // Create mentor/counselor calendar slot if mentor is specified
        let mentorCalendarSlot = null;
        if (dto.mentorId) {
          mentorCalendarSlot = await this.calendarService.createSlotDirect(
            {
              userId: dto.mentorId,
              userType: UserType.MENTOR,
              startTime: scheduledAtIso,
              durationMinutes: durationMinutes,
              sessionType: CalendarSessionType.COMM_SESSION,
              title: dto.title,
              sessionId: undefined,
              metadata: {
                otherPartyName: 'studentName',
              },
            },
            tx,
          );

          if (!mentorCalendarSlot) {
            throw new TimeConflictException('The mentor already has a scheduling conflict');
          }

          this.logger.debug(`Mentor calendar slot created: ${mentorCalendarSlot.id}`);
        }

        // Step 3: Create session record in domain layer
      const session = await this.domainCommSessionService.createSession({
        meetingId: undefined, // Meeting ID is null initially
          sessionType: CommSessionType.COMM_SESSION,
          studentUserId: dto.studentId,
          mentorUserId: dto.mentorId,
          counselorUserId: dto.counselorId,
          createdByCounselorId: dto.counselorId,
          title: dto.title,
          description: dto.description,
        scheduledAt: scheduledAtIso, // Pass ISO string
          status: CommSessionStatus.PENDING_MEETING, // Set initial status (async meeting creation)
      });

        return {
          sessionId: session.id,
          status: session.status, // PENDING_MEETING
          scheduledAt: session.scheduledAt, // Date object from domain entity
          studentCalendarSlotId: studentCalendarSlot.id,
          mentorCalendarSlotId: mentorCalendarSlot?.id,
        };
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Comm session created successfully in ${duration}ms`);
      addSpanEvent('session.creation.success');

      // Publish event to trigger async meeting creation
      this.eventEmitter.emit(COMM_SESSION_CREATED_EVENT, {
        sessionId: sessionResult.sessionId,
        studentId: dto.studentId,
        mentorId: dto.mentorId,
        counselorId: dto.counselorId,
        scheduledStartTime: scheduledAtIso,
        duration: dto.duration || 60,
        meetingProvider: dto.meetingProvider || 'feishu',
        topic: dto.title,
        studentCalendarSlotId: sessionResult.studentCalendarSlotId,
        mentorCalendarSlotId: sessionResult.mentorCalendarSlotId,
      });

      this.logger.log(`Published COMM_SESSION_CREATED_EVENT for session ${sessionResult.sessionId}`);

      return {
        sessionId: sessionResult.sessionId,
        status: sessionResult.status,
        scheduledAt: sessionResult.scheduledAt,
      };
    } catch (error) {
      this.logger.error(`Failed to create comm session: ${error.message}`, error.stack);
      addSpanEvent('session.creation.error');
      throw error;
    }
  }

  /**
   * Update comm session
   * Handles two scenarios:
   * 1. Time/duration change: Delete old calendar slots, create new ones, emit update event
   * 2. Metadata only: Update calendar title/session details, emit notification event
   */
  @Trace({
    name: 'comm_session.update',
    attributes: { 'operation.type': 'update' },
  })
  async updateSession(sessionId: string, dto: UpdateCommSessionDto) {
    this.logger.log(`Updating comm session: sessionId=${sessionId}`);
    addSpanAttributes({
      'session.id': sessionId,
      'update.fields': Object.keys(dto).join(','),
    });

    try {
      // Step 1: Fetch old session data for comparison (use query service to get meeting details)
      const oldSession = await this.domainCommSessionQueryService.getSessionById(sessionId);
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

      // Step 4: Execute transaction to update calendar and session
      const updatedSession = await this.db.transaction(async (tx: DrizzleTransaction) => {
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
          const studentSlot = await this.calendarService.createSlotDirect(
            {
              userId: oldSession.studentUserId,
              userType: UserType.STUDENT,
              startTime: scheduledAtIso,
              durationMinutes: newDuration,
              sessionType: CalendarSessionType.COMM_SESSION,
              title: dto.title || oldSession.title,
              sessionId: sessionId,
              metadata: {
                otherPartyName: oldSession.mentorUserId ? 'mentorName' : 'counselorName',
              },
            },
            tx,
          );

          if (!studentSlot) {
            throw new TimeConflictException('The student already has a scheduling conflict');
          }

          // Create mentor/counselor slot if exists
          if (oldSession.mentorUserId) {
            const mentorSlot = await this.calendarService.createSlotDirect(
              {
                userId: oldSession.mentorUserId,
                userType: UserType.MENTOR,
                startTime: scheduledAtIso,
                durationMinutes: newDuration,
                sessionType: CalendarSessionType.COMM_SESSION,
                title: dto.title || oldSession.title,
                sessionId: sessionId,
                metadata: {
                  otherPartyName: 'studentName',
                },
              },
              tx,
            );

            if (!mentorSlot) {
              throw new TimeConflictException('The mentor already has a scheduling conflict');
            }
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
        const updated = await this.domainCommSessionService.updateSession(
          sessionId,
          {
          title: dto.title,
          description: dto.description,
          scheduledAt: scheduledAtIso,
          },
        );

        return updated;
      });

      this.logger.log(`Comm session updated: sessionId=${sessionId}`);
      addSpanEvent('session.update.success');

      // Step 5: Extract meeting provider from oldSession
      const meetingProvider = oldSessionData.meetingProvider || 'feishu';

      // Step 6: Emit event based on what changed
      if (timeChanged || durationChanged) {
        // Emit event to trigger async meeting update (when time or duration changes)
        this.eventEmitter.emit(COMM_SESSION_UPDATED_EVENT, {
          sessionId: sessionId,
          meetingId: oldSession.meetingId,
          oldScheduledAt: meetingScheduleStartTime, // Use actual meeting schedule time
          newScheduledAt: scheduledAtIso,
          oldDuration: meetingScheduleDuration, // Use actual meeting duration
          newDuration: newDuration,
          newTitle: dto.title || oldSession.title,
          studentId: oldSession.studentUserId,
          mentorId: oldSession.mentorUserId,
          counselorId: oldSession.counselorUserId || oldSession.createdByCounselorId,
          meetingProvider: meetingProvider,
        } as any);
        this.logger.log(`Published COMM_SESSION_UPDATED_EVENT for session ${sessionId}`);
      }

      // Always emit notification event (for both metadata and time changes)
      this.eventEmitter.emit(SESSION_RESCHEDULED_COMPLETED, {
        sessionId: sessionId,
        changeType: timeChanged ? 'TIME' : 'METADATA',
        studentId: oldSession.studentUserId,
        mentorId: oldSession.mentorUserId,
        counselorId: oldSession.counselorUserId || oldSession.createdByCounselorId,
        newScheduledAt: scheduledAtIso,
        newTitle: dto.title || oldSession.title,
        meetingProvider: meetingProvider,
      } as any);
      this.logger.log(`Published SESSION_RESCHEDULED_COMPLETED for session ${sessionId}`);

      // Construct response with all updated values including meeting info
      // Meeting URL does not change when rescheduling, so include it from oldSession
      return {
        ...updatedSession,
        title: dto.title || updatedSession.title,
        description: dto.description !== undefined ? dto.description : updatedSession.description,
        scheduledAt: scheduledAtIso || updatedSession.scheduledAt,
        duration: newDuration, // Use the newly calculated duration
        // Include complete meeting object for mapper to extract all meeting-related fields
        meeting: oldSession.meeting,
      };
    } catch (error) {
      this.logger.error(`Failed to update comm session: ${error.message}`, error.stack);
      addSpanEvent('session.update.error');
      throw error;
    }
  }

  /**
   * Cancel comm session
   * Synchronous flow (transaction): Update session + Release calendar slots
   * Asynchronous flow (event): Cancel meeting via third-party API
   *
   * @param sessionId Session ID
   * @param reason Cancellation reason
   * @returns Cancelled session with CANCELLED status
   */
  @Trace({
    name: 'comm_session.cancel',
    attributes: { 'operation.type': 'cancel' },
  })
  async cancelSession(sessionId: string, reason?: string) {
    this.logger.log(`Canceling comm session: sessionId=${sessionId}, reason=${reason}`);
    addSpanAttributes({
      'session.id': sessionId,
      'cancellation.reason': reason || 'not_specified',
    });

    try {
      // Step 1: Fetch session details before cancellation
      const session = await this.domainCommSessionQueryService.getSessionById(sessionId);
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
        // Update session status to CANCELLED
        await this.domainCommSessionService.cancelSession(sessionId, reason);

        // Release calendar slots (update status to cancelled)
        await this.calendarService.updateSlots(
          sessionId,
          { status: 'cancelled' as any },
          tx,
        );
        this.logger.debug(`Calendar slots cancelled for session ${sessionId}`);
      });

      // Step 4: Re-fetch session to get updated data with cancelledAt
      const cancelledSession = await this.domainCommSessionQueryService.getSessionById(sessionId);

      this.logger.log(`Comm session cancelled in transaction: sessionId=${sessionId}`);
      addSpanEvent('session.cancel.transaction.success');

      // Step 5: Extract meeting provider and session details
      const sessionData = session as any;
      const meetingProvider = sessionData.meetingProvider || 'feishu';

      // Step 6: Publish cancellation event for async meeting cancellation
      this.eventEmitter.emit(COMM_SESSION_CANCELLED_EVENT, {
        sessionId: sessionId,
        meetingId: session.meetingId,
        studentId: session.studentUserId,
        mentorId: session.mentorUserId,
        counselorId: session.createdByCounselorId,
        scheduledAt: session.scheduledAt,
        cancelReason: reason,
        cancelledAt: (cancelledSession as any).cancelledAt,
        meetingProvider: meetingProvider,
      });

      this.logger.log(`Published COMM_SESSION_CANCELLED_EVENT for session ${sessionId}`);
      addSpanEvent('session.cancel.success');

      // Step 7: Return cancelled session with meeting info
      return {
        ...cancelledSession,
        meeting: session.meeting,
      };
    } catch (error) {
      this.logger.error(`Failed to cancel comm session: ${error.message}`, error.stack);
      addSpanEvent('session.cancel.error');
      throw error;
    }
  }

  /**
   * Soft delete comm session
   */
  @Trace({
    name: 'comm_session.delete',
    attributes: { 'operation.type': 'delete' },
  })
  async deleteSession(sessionId: string) {
    this.logger.log(`Soft deleting comm session: sessionId=${sessionId}`);
    addSpanAttributes({ 'session.id': sessionId });

    try {
      await this.db.transaction(async (tx: DrizzleTransaction) => {
        await this.domainCommSessionService.deleteSession(sessionId);

        // Note: Calendar slots and meetings are not deleted, just marked as part of deleted session
      });

      this.logger.log(`Comm session deleted: sessionId=${sessionId}`);
      addSpanEvent('session.delete.success');
      return { sessionId, status: 'deleted' };
    } catch (error) {
      this.logger.error(`Failed to delete comm session: ${error.message}`, error.stack);
      addSpanEvent('session.delete.error');
      throw error;
    }
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
      return this.domainCommSessionQueryService.getStudentSessions(studentId, filters);
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
   * then retrieves all their communication sessions
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
    return this.domainCommSessionQueryService.getSessionsByStudentIds(studentIds, filters || {});
  }

  /**
   * Get sessions for a mentor
   */
  private async getSessionsByMentor(mentorId: string, filters?: any) {
    this.logger.debug(`Fetching sessions for mentor: mentorId=${mentorId}`);
    return this.domainCommSessionQueryService.getMentorSessions(mentorId, filters);
  }

  /**
   * Get sessions for a student
   */
  private async getSessionsByStudent(studentId: string, filters?: any) {
    this.logger.debug(`Fetching sessions for student: studentId=${studentId}`);
    return this.domainCommSessionQueryService.getStudentSessions(studentId, filters);
  }

  /**
   * Get session details
   */
  async getSessionById(sessionId: string) {
    this.logger.debug(`Fetching comm session details: sessionId=${sessionId}`);
    return this.domainCommSessionQueryService.getSessionById(sessionId);
  }
}

