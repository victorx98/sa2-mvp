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
import { CLASS_SESSION_CREATED_EVENT, CLASS_SESSION_UPDATED_EVENT, CLASS_SESSION_CANCELLED_EVENT } from '@shared/events/event-constants';
import { ClassSessionService as DomainClassSessionService } from '@domains/services/class/class-sessions/services/class-session.service';
import { ClassSessionStatus, SessionType as ClassSessionType } from '@domains/services/class/class-sessions/entities/class-session.entity';
import { CreateClassSessionDto as DomainCreateClassSessionDto } from '@domains/services/class/class-sessions/dto/create-class-session.dto';
import { ClassService as DomainClassService } from '@domains/services/class/classes/services/class.service';
import { ClassSessionQueryService as DomainClassSessionQueryService } from '@domains/query/services/class-session-query.service';

// DTOs
export interface CreateClassSessionDto {
  classId: string;
  mentorId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  duration?: number;
  meetingProvider?: string;
  serviceType?: string;
  counselorId?: string;
}

export interface UpdateClassSessionDto {
  title?: string;
  description?: string;
  scheduledAt?: Date;
  duration?: number;
}

/**
 * Application Layer - Class Session Service
 *
 * Responsibility:
 * - Orchestrate the complete flow of creating, updating, canceling class sessions
 * - Coordinate between Core Services (Calendar, Meeting)
 * - Handle transaction management
 * - Class sessions are group sessions for multiple students in a class
 */
@Injectable()
export class ClassSessionService {
  private readonly logger = new Logger(ClassSessionService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainClassSessionService: DomainClassSessionService,
    private readonly domainClassService: DomainClassService,
    private readonly domainClassSessionQueryService: DomainClassSessionQueryService,
    private readonly calendarService: CalendarService,
    private readonly eventEmitter: EventEmitter2,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Create a new class session asynchronously
   * Returns immediately with PENDING_MEETING status
   * Meeting creation happens asynchronously via event handler
   *
   * @param dto Create session input
   * @returns Created session details with PENDING_MEETING status
   */
  @Trace({
    name: 'class_session.create',
    attributes: { 'operation.type': 'create' },
  })
  async createSession(dto: CreateClassSessionDto) {
    const startTime = Date.now();

    this.logger.log(
      `Creating class session: classId=${dto.classId}, mentorId=${dto.mentorId}`,
    );

    addSpanAttributes({
      'class.id': dto.classId,
      'mentor.id': dto.mentorId,
      'session.type': 'class_session',
      'meeting.provider': dto.meetingProvider || 'feishu',
    });

    try {
      addSpanEvent('session.creation.start');

      // Validate that mentor is assigned to the class
      const hasMentor = await this.domainClassService.hasMentor(dto.classId, dto.mentorId);
      if (!hasMentor) {
        throw new Error(`Mentor ${dto.mentorId} is not assigned to class ${dto.classId}`);
      }

      const scheduledAtIso = dto.scheduledAt instanceof Date
        ? dto.scheduledAt.toISOString()
        : dto.scheduledAt;

      // Create calendar slots (async meeting creation via event handler)
      const sessionResult = await this.db.transaction(async (tx: DrizzleTransaction) => {
        this.logger.debug('Starting database transaction for session creation');

        // Step 0: Create service hold (reserve service credits)
        // const hold = await this.serviceHoldService.createHold(
        //   {
        //     studentId: dto.studentId,
        //     serviceType: dto.serviceType,
        //     quantity: 1,
        //     createdBy: dto.counselorId,
        //   },
        //   tx,
        // );
        // this.logger.debug(`Service hold created: ${hold.id}`);

        const durationMinutes = dto.duration || 60;

        // Create mentor calendar slot
        const mentorCalendarSlot = await this.calendarService.createSlotDirect(
          {
            userId: dto.mentorId,
            userType: UserType.MENTOR,
            startTime: scheduledAtIso,
            durationMinutes: durationMinutes,
            sessionType: CalendarSessionType.CLASS_SESSION,
            title: dto.title,
            sessionId: undefined,
          },
          tx,
        );

        if (!mentorCalendarSlot) {
          throw new TimeConflictException('The mentor already has a scheduling conflict');
        }

        this.logger.debug(`Mentor calendar slot created: ${mentorCalendarSlot.id}`);

        // Step 3: Create session record in domain layer
        const session = await this.domainClassSessionService.createSession({
          meetingId: undefined, // Meeting ID is null initially
          sessionType: ClassSessionType.CLASS_SESSION,
          classId: dto.classId,
          mentorUserId: dto.mentorId,
          title: dto.title,
          description: dto.description,
          scheduledAt: scheduledAtIso, // Pass ISO string
          status: ClassSessionStatus.PENDING_MEETING, // Set initial status
        });

        return {
          sessionId: session.id,
          status: ClassSessionStatus.PENDING_MEETING,
          scheduledAt: scheduledAtIso,
          mentorCalendarSlotId: mentorCalendarSlot.id,
        };
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Class session created successfully in ${duration}ms`);
      addSpanEvent('session.creation.success');

      // Publish event to trigger async meeting creation
      this.eventEmitter.emit(CLASS_SESSION_CREATED_EVENT, {
        sessionId: sessionResult.sessionId,
        classId: dto.classId,
        mentorId: dto.mentorId,
        scheduledStartTime: scheduledAtIso,
        duration: dto.duration || 60,
        meetingProvider: dto.meetingProvider || 'feishu',
        topic: dto.title,
        mentorCalendarSlotId: sessionResult.mentorCalendarSlotId,
      });

      this.logger.log(`Published CLASS_SESSION_CREATED_EVENT for session ${sessionResult.sessionId}`);

      return {
        sessionId: sessionResult.sessionId,
        status: sessionResult.status,
        scheduledAt: sessionResult.scheduledAt,
      };
    } catch (error) {
      this.logger.error(`Failed to create class session: ${error.message}`, error.stack);
      addSpanEvent('session.creation.error');
      throw error;
    }
  }

  /**
   * Update class session
   * Handles two scenarios:
   * 1. Time/duration change: Cancel old calendar slots, create new ones, emit update event
   * 2. Metadata only: Update calendar title/session details
   */
  @Trace({
    name: 'class_session.update',
    attributes: { 'operation.type': 'update' },
  })
  async updateSession(sessionId: string, dto: UpdateClassSessionDto) {
    this.logger.log(`Updating class session: sessionId=${sessionId}`);
    addSpanAttributes({
      'session.id': sessionId,
      'update.fields': Object.keys(dto).join(','),
    });

    try {
      // Step 1: Fetch old session data with meeting details
      const oldSession = await this.domainClassSessionQueryService.getSessionById(sessionId);
      if (!oldSession) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      // Step 2: Convert Date to ISO string if provided
      const scheduledAtIso = dto.scheduledAt
        ? (dto.scheduledAt instanceof Date ? dto.scheduledAt.toISOString() : dto.scheduledAt)
        : undefined;

      // Step 3: Determine if time/duration changed
      const oldSessionData = oldSession as any;
      const meetingScheduleStartTime = oldSessionData.meeting?.scheduleStartTime;

      if (!meetingScheduleStartTime) {
        throw new Error(`Unable to determine meeting schedule start time for session ${sessionId}`);
      }

      const timeChanged = scheduledAtIso && scheduledAtIso !== meetingScheduleStartTime;

      const meetingScheduleDuration = oldSessionData.meeting?.scheduleDuration;
      const newDuration = dto.duration ?? meetingScheduleDuration;

      if (!newDuration) {
        throw new Error(`Unable to determine duration for session ${sessionId}`);
      }

      const durationChanged = dto.duration && dto.duration !== meetingScheduleDuration;

      // Step 4: Execute transaction to update calendar and session
      await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Update calendar if time or duration changed
        if (timeChanged || durationChanged) {
          // Cancel old calendar slots
          await this.calendarService.updateSlots(
            sessionId,
            { status: 'cancelled' as any },
            tx,
          );
          this.logger.debug(`Old calendar slots cancelled for session ${sessionId}`);

          // Create new mentor calendar slot
          const mentorSlot = await this.calendarService.createSlotDirect(
            {
              userId: oldSession.mentorUserId,
              userType: UserType.MENTOR,
              startTime: scheduledAtIso || meetingScheduleStartTime,
              durationMinutes: newDuration,
              sessionType: CalendarSessionType.CLASS_SESSION,
              title: dto.title || oldSession.title,
              sessionId: sessionId,
            },
            tx,
          );

          if (!mentorSlot) {
            throw new TimeConflictException('The mentor already has a scheduling conflict');
          }

          this.logger.debug(`New calendar slot created for session ${sessionId}`);
        } else if (dto.title) {
          // Only title changed, update calendar title
          await this.calendarService.updateSlots(
            sessionId,
            { title: dto.title },
            tx,
          );
        }

        // Update session in domain layer
        const updateData: any = {};
        if (dto.title) updateData.title = dto.title;
        if (dto.description !== undefined) updateData.description = dto.description;
        if (scheduledAtIso) updateData.scheduledAt = scheduledAtIso;

        await this.domainClassSessionService.updateSession(sessionId, updateData, tx);
      });

      // Step 5: Emit update event if time/duration changed
      if (timeChanged || durationChanged) {
        this.eventEmitter.emit(CLASS_SESSION_UPDATED_EVENT, {
          sessionId: sessionId,
          classId: oldSession.classId,
          meetingId: oldSession.meetingId,
          oldScheduledStartTime: meetingScheduleStartTime,
          newScheduledStartTime: scheduledAtIso || meetingScheduleStartTime,
          oldDuration: meetingScheduleDuration,
          newDuration: newDuration,
          topic: dto.title || oldSession.title,
        });
        this.logger.log(`Published CLASS_SESSION_UPDATED_EVENT for session ${sessionId}`);
      }

      this.logger.log(`Class session updated: sessionId=${sessionId}`);
      addSpanEvent('session.update.success');
      
      // Return updated session with meeting details
      return this.domainClassSessionQueryService.getSessionById(sessionId);
    } catch (error) {
      this.logger.error(`Failed to update class session: ${error.message}`, error.stack);
      addSpanEvent('session.update.error');
      throw error;
    }
  }

  /**
   * Cancel class session
   * Sync Flow: Update session status, cancel calendar slots
   * Async Flow: Cancel meeting via event handler
   */
  @Trace({
    name: 'class_session.cancel',
    attributes: { 'operation.type': 'cancel' },
  })
  async cancelSession(sessionId: string, reason?: string) {
    this.logger.log(`Canceling class session: sessionId=${sessionId}, reason=${reason}`);
    addSpanAttributes({
      'session.id': sessionId,
      'cancellation.reason': reason || 'not_specified',
    });

    try {
      // Step 1: Get session details for event
      const session = await this.domainClassSessionQueryService.getSessionById(sessionId);
      if (!session) {
        throw new NotFoundException(`Session ${sessionId} not found`);
      }

      // Step 2: Execute transaction to update session and calendar
      await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Cancel session in domain layer
        await this.domainClassSessionService.cancelSession(sessionId, reason);

        // Cancel calendar slots (update status to 'cancelled')
        await this.calendarService.updateSlots(
          sessionId,
          { status: 'cancelled' as any },
          tx,
        );

        this.logger.debug(`Calendar slots cancelled for session ${sessionId}`);
      });

      // Step 3: Emit cancellation event for async meeting cancellation
      this.eventEmitter.emit(CLASS_SESSION_CANCELLED_EVENT, {
        sessionId: sessionId,
        classId: (session as any).classId,
        meetingId: (session as any).meetingId,
        mentorId: (session as any).mentorUserId,
        cancelledAt: new Date().toISOString(),
        cancelReason: reason || 'Cancelled by administrator',
      });

      this.logger.log(`Published CLASS_SESSION_CANCELLED_EVENT for session ${sessionId}`);
      this.logger.log(`Class session cancelled: sessionId=${sessionId}`);
      addSpanEvent('session.cancel.success');
      return { sessionId, status: 'cancelled' };
    } catch (error) {
      this.logger.error(`Failed to cancel class session: ${error.message}`, error.stack);
      addSpanEvent('session.cancel.error');
      throw error;
    }
  }

  /**
   * Soft delete class session
   * Marks session as deleted in domain layer
   */
  @Trace({
    name: 'class_session.delete',
    attributes: { 'operation.type': 'delete' },
  })
  async deleteSession(sessionId: string) {
    this.logger.log(`Soft deleting class session: sessionId=${sessionId}`);
    addSpanAttributes({ 'session.id': sessionId });

    try {
      await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Soft delete session in domain layer
        await this.domainClassSessionService.deleteSession(sessionId);

        // Note: Calendar slots and meetings are not deleted, just marked as part of deleted session
      });

      this.logger.log(`Class session deleted: sessionId=${sessionId}`);
      addSpanEvent('session.delete.success');
      return { sessionId, status: 'deleted' };
    } catch (error) {
      this.logger.error(`Failed to delete class session: ${error.message}`, error.stack);
      addSpanEvent('session.delete.error');
      throw error;
    }
  }

  /**
   * Get session details with cross-domain data
   * Delegates to query layer for enriched data
   */
  async getSessionById(sessionId: string) {
    this.logger.debug(`Fetching class session details: sessionId=${sessionId}`);
    return this.domainClassSessionQueryService.getSessionById(sessionId);
  }
}

