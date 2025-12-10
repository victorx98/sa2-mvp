import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CalendarService } from '@core/calendar';
import {
  UserType,
  SessionType as CalendarSessionType,
} from '@core/calendar/interfaces/calendar-slot.interface';
import { MeetingProviderType } from '@core/meeting';
import { GapAnalysisService as DomainGapAnalysisService } from '@domains/services/sessions/gap-analysis/services/gap-analysis.service';
import { GapAnalysisQueryService } from '@domains/services/sessions/gap-analysis/services/gap-analysis-query.service';
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
  GAP_ANALYSIS_SESSION_CREATED_EVENT,
  GAP_ANALYSIS_SESSION_UPDATED_EVENT,
  SESSION_RESCHEDULED_COMPLETED,
} from '@shared/events/event-constants';

// DTOs
export interface CreateGapAnalysisDto {
  counselorId: string;
  studentId: string;
  mentorId: string;
  sessionTypeId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  duration?: number;
  meetingProvider?: string;
}

export interface UpdateGapAnalysisDto {
  title?: string;
  description?: string;
  scheduledAt?: Date;
  duration?: number; // NEW: Added duration field
}

/**
 * Application Layer - Gap Analysis Service
 *
 * Responsibility:
 * - Orchestrate the complete flow of creating, updating, canceling, and deleting gap analysis sessions
 * - Coordinate between Domain Services and Core Services (Calendar, Meeting)
 * - Handle transaction management
 * - Implement business logic for complex operations (create)
 */
@Injectable()
export class GapAnalysisService {
  private readonly logger = new Logger(GapAnalysisService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainGapAnalysisService: DomainGapAnalysisService,
    private readonly gapAnalysisQueryService: GapAnalysisQueryService,
    private readonly calendarService: CalendarService,
    private readonly eventEmitter: EventEmitter2,
    private readonly serviceHoldService: ServiceHoldService,
    private readonly metricsService: MetricsService,
    private readonly studentCounselorService: StudentCounselorService,
  ) {}

  /**
   * Create a new gap analysis session asynchronously
   * Returns immediately with PENDING_MEETING status
   * Meeting creation happens asynchronously via event handler
   *
   * @param dto Create session input
   * @returns Created session details with PENDING_MEETING status
   */
  @Trace({
    name: 'gap_analysis.create',
    attributes: { 'operation.type': 'create' },
  })
  async createSession(dto: CreateGapAnalysisDto) {
    const startTime = Date.now();

    this.logger.log(
      `Creating gap analysis session: studentId=${dto.studentId}, mentorId=${dto.mentorId}`,
    );

    addSpanAttributes({
      'student.id': dto.studentId,
      'mentor.id': dto.mentorId,
      'counselor.id': dto.counselorId,
      'session.type': 'gap_analysis',
      'meeting.provider': dto.meetingProvider || 'feishu',
    });

    try {
      addSpanEvent('session.creation.start');

      // Convert Date to ISO string for API requirements
      const scheduledAtIso = dto.scheduledAt instanceof Date
        ? dto.scheduledAt.toISOString()
        : dto.scheduledAt;

      // Synchronous flow: Create calendar slots and session record only (no meeting creation)
      // Meeting creation is handled asynchronously by GapAnalysisCreatedEventHandler
      const sessionResult = await this.db.transaction(async (tx: DrizzleTransaction) => {
        this.logger.debug('Starting database transaction for session creation');

        // Step 1: Create service hold (reserve service credits)
        // const hold = await this.serviceHoldService.createHold(
        //   {
        //     studentId: dto.studentId,
        //     serviceType: 'gap_analysis',
        //     quantity: 1,
        //     createdBy: dto.counselorId,
        //   },
        //   tx,
        // );
        // this.logger.debug(`Service hold created: ${hold.id}`);

        // Calculate duration with default value
        const durationMinutes = dto.duration || 60;

        // Step 1: Create calendar slots for both mentor and student
        const mentorCalendarSlot = await this.calendarService.createSlotDirect(
          {
            userId: dto.mentorId,
            userType: UserType.MENTOR,
            startTime: scheduledAtIso,
            durationMinutes: durationMinutes,
            sessionType: CalendarSessionType.GAP_ANALYSIS,
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

        const studentCalendarSlot = await this.calendarService.createSlotDirect(
          {
            userId: dto.studentId,
            userType: UserType.STUDENT,
            startTime: scheduledAtIso,
            durationMinutes: durationMinutes,
            sessionType: CalendarSessionType.GAP_ANALYSIS,
            title: dto.title,
            sessionId: undefined,
            metadata: {
              otherPartyName: 'mentorName',
            },
          },
          tx,
        );

        if (!studentCalendarSlot) {
          throw new TimeConflictException('The student already has a scheduling conflict');
        }

        this.logger.debug(`Student calendar slot created: ${studentCalendarSlot.id}`);

        // Step 2: Create session record in domain layer (without meeting_id, status=PENDING_MEETING)
        const session = await this.domainGapAnalysisService.createSession(
          {
            meetingId: undefined,
            sessionType: SessionType.GAP_ANALYSIS,
            sessionTypeId: dto.sessionTypeId,
            studentUserId: dto.studentId,
            mentorUserId: dto.mentorId,
            createdByCounselorId: dto.counselorId,
            title: dto.title,
            description: dto.description,
            scheduledAt: scheduledAtIso,
          },
          tx,
        );

        this.logger.debug(`Gap analysis session created: sessionId=${session.id}`);

        return {
          sessionId: session.id,
          status: session.status,
          scheduledAt: session.scheduledAt,
          mentorCalendarSlotId: mentorCalendarSlot.id,
          studentCalendarSlotId: studentCalendarSlot.id,
        };
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Gap analysis session created successfully in ${duration}ms`);
      addSpanEvent('session.creation.success');

      // Publish event to trigger async meeting creation (outside transaction)
      this.eventEmitter.emit(GAP_ANALYSIS_SESSION_CREATED_EVENT, {
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
      });

      this.logger.log(`Published GAP_ANALYSIS_SESSION_CREATED_EVENT for session ${sessionResult.sessionId}`);

      return {
        sessionId: sessionResult.sessionId,
        status: sessionResult.status,
        scheduledAt: sessionResult.scheduledAt,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create gap analysis session: ${error.message}`,
        error.stack,
      );
      addSpanEvent('session.creation.error');
      throw error;
    }
  }

  /**
   * Update an existing gap analysis session
   * Handles time/duration changes with calendar updates and async meeting updates
   *
   * @param sessionId Session ID
   * @param dto Update data (title, description, scheduledAt, duration)
   * @returns Updated session with all new values
   */
  @Trace({
    name: 'gap_analysis.update',
    attributes: { 'operation.type': 'update' },
  })
  async updateSession(sessionId: string, dto: UpdateGapAnalysisDto) {
    this.logger.log(`Updating gap analysis session: sessionId=${sessionId}`);

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
      const oldSession = await this.gapAnalysisQueryService.getSessionById(sessionId);
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
              durationMinutes: newDuration, // Use new duration
              sessionType: CalendarSessionType.GAP_ANALYSIS,
              title: dto.title || oldSession.title,
              sessionId: sessionId,
              meetingId: oldSession.meetingId,
              metadata: {
                otherPartyName: 'studentName',
              },
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
              durationMinutes: newDuration, // Use new duration
              sessionType: CalendarSessionType.GAP_ANALYSIS,
              title: dto.title || oldSession.title,
              sessionId: sessionId,
              meetingId: oldSession.meetingId,
              metadata: {
                otherPartyName: 'mentorName',
              },
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
        const updateResult = await this.domainGapAnalysisService.updateSession(
          sessionId,
          {
        title: dto.title,
        description: dto.description,
            scheduledAt: scheduledAtIso, // Convert to ISO string format
          },
          tx,
        );

        return updateResult;
      });

      this.logger.log(`Gap analysis session updated: sessionId=${sessionId}`);
      addSpanEvent('session.update.success');

      // Step 4: Extract meeting provider from oldSession
      const meetingProvider = oldSessionData.meetingProvider || 'feishu';

      // Step 5: Emit events based on what changed
      if (timeChanged || durationChanged) {
        // Emit event to trigger async meeting update (when time or duration changes)
        this.eventEmitter.emit(GAP_ANALYSIS_SESSION_UPDATED_EVENT, {
          sessionId: sessionId,
          meetingId: oldSession.meetingId,
          oldScheduledAt: meetingScheduleStartTime, // Use actual meeting schedule time
          newScheduledAt: scheduledAtIso,
          oldDuration: meetingScheduleDuration, // Use actual meeting duration
          newDuration: newDuration,
          newTitle: dto.title || oldSession.title,
          mentorId: oldSession.mentorUserId,
          studentId: oldSession.studentUserId,
          counselorId: oldSession.createdByCounselorId,
          meetingProvider: meetingProvider,
        } as any);
        this.logger.log(`Published GAP_ANALYSIS_SESSION_UPDATED_EVENT for session ${sessionId}`);
      }

      // Always emit SESSION_RESCHEDULED_COMPLETED for both time and metadata changes
      this.eventEmitter.emit(SESSION_RESCHEDULED_COMPLETED, {
        sessionId: sessionId,
        changeType: timeChanged ? 'TIME' : 'METADATA',
        mentorId: oldSession.mentorUserId,
        studentId: oldSession.studentUserId,
        counselorId: oldSession.createdByCounselorId,
        newScheduledAt: scheduledAtIso,
        newTitle: dto.title || oldSession.title,
        meetingProvider: meetingProvider,
      } as any);
      this.logger.log(`Published SESSION_RESCHEDULED_COMPLETED for session ${sessionId}`);

      // Step 6: Construct response with all updated values including meeting info
      // Do not re-query DB as meetings table will be updated asynchronously
      return {
        ...updatedSession,
        title: dto.title || updatedSession.title,
        description: dto.description !== undefined ? dto.description : updatedSession.description,
        scheduledAt: scheduledAtIso || updatedSession.scheduledAt,
        duration: newDuration, // Use the newly calculated duration
        // Include complete meeting object for mapper
        meeting: oldSession.meeting,
      };
    } catch (error) {
      this.logger.error(
        `Failed to update gap analysis session: ${error.message}`,
        error.stack,
      );
      addSpanEvent('session.update.error');
      throw error;
    }
  }

  /**
   * Cancel a gap analysis session
   *
   * @param sessionId Session ID
   * @param reason Cancellation reason
   * @returns Cancellation result
   */
  @Trace({
    name: 'gap_analysis.cancel',
    attributes: { 'operation.type': 'cancel' },
  })
  async cancelSession(sessionId: string, reason: string) {
    this.logger.log(`Canceling gap analysis session: sessionId=${sessionId}`);

    addSpanAttributes({
      'session.id': sessionId,
      'cancellation.reason': reason,
    });

    try {
      // Step 1: Get session details
      const session = await this.gapAnalysisQueryService.getSessionById(sessionId);
      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      // Step 2: Cancel in domain layer
      await this.domainGapAnalysisService.cancelSession(sessionId, reason);

      this.logger.log(`Gap analysis session cancelled: sessionId=${sessionId}`);
      addSpanEvent('session.cancel.success');

      return { sessionId, status: 'cancelled' };
    } catch (error) {
      this.logger.error(
        `Failed to cancel gap analysis session: ${error.message}`,
        error.stack,
      );
      addSpanEvent('session.cancel.error');
      throw error;
    }
  }

  /**
   * Delete (soft delete) a gap analysis session
   *
   * @param sessionId Session ID
   * @returns Deletion result
   */
  @Trace({
    name: 'gap_analysis.delete',
    attributes: { 'operation.type': 'delete' },
  })
  async deleteSession(sessionId: string) {
    this.logger.log(`Deleting gap analysis session: sessionId=${sessionId}`);

    addSpanAttributes({
      'session.id': sessionId,
    });

    try {
      // Get session details before deletion
      const session = await this.gapAnalysisQueryService.getSessionById(sessionId);
      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      // Soft delete in domain layer
      await this.domainGapAnalysisService.deleteSession(sessionId);

      this.logger.log(`Gap analysis session deleted: sessionId=${sessionId}`);
      addSpanEvent('session.delete.success');

      return { sessionId, status: 'deleted' };
    } catch (error) {
      this.logger.error(
        `Failed to delete gap analysis session: ${error.message}`,
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

    const session = await this.gapAnalysisQueryService.getSessionById(sessionId);
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
      return this.gapAnalysisQueryService.getStudentSessions(studentId, filters);
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
   * then retrieves all their gap analysis sessions
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
    return this.gapAnalysisQueryService.getSessionsByStudentIds(studentIds, filters || {});
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

    return this.gapAnalysisQueryService.getMentorSessions(mentorId, filters);
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

    return this.gapAnalysisQueryService.getStudentSessions(studentId, filters);
  }
}

