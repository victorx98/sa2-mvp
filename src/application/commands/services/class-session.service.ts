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
import { CLASS_SESSION_CREATED_EVENT } from '@shared/events/event-constants';
import { ClassSessionService as DomainClassSessionService } from '@domains/services/class/class-sessions/services/class-session.service';
import { ClassSessionStatus, SessionType as ClassSessionType } from '@domains/services/class/class-sessions/entities/class-session.entity';
import { CreateClassSessionDto as DomainCreateClassSessionDto } from '@domains/services/class/class-sessions/dto/create-class-session.dto';
import { ClassService as DomainClassService } from '@domains/services/class/classes/services/class.service';

// DTOs
export interface CreateClassSessionDto {
  classId: string;
  mentorId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  duration?: number;
  meetingProvider?: string;
}

export interface UpdateClassSessionDto {
  title?: string;
  description?: string;
  scheduledAt?: Date;
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
   * Updates session info and calendar slots if needed
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
      await this.db.transaction(async (tx: DrizzleTransaction) => {
        const scheduledAtIso = dto.scheduledAt
          ? (dto.scheduledAt instanceof Date ? dto.scheduledAt.toISOString() : dto.scheduledAt)
          : undefined;

        // Update session in domain layer
        const updateData: any = {};
        if (dto.title) updateData.title = dto.title;
        if (dto.description !== undefined) updateData.description = dto.description;
        if (scheduledAtIso) updateData.scheduledAt = scheduledAtIso;

        await this.domainClassSessionService.updateSession(sessionId, updateData);

        // TODO: If scheduledAt changed, need to update calendar slots
        // This requires getting the session first to find related calendar slots
      });

      this.logger.log(`Class session updated: sessionId=${sessionId}`);
      addSpanEvent('session.update.success');
      return { sessionId, updated: true };
    } catch (error) {
      this.logger.error(`Failed to update class session: ${error.message}`, error.stack);
      addSpanEvent('session.update.error');
      throw error;
    }
  }

  /**
   * Cancel class session
   * Cancels session in domain layer and releases calendar slots
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
      await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Cancel session in domain layer
        await this.domainClassSessionService.cancelSession(sessionId, reason);

        // TODO: Release calendar slots
        // TODO: Cancel meeting if needed (via MeetingManagerService)
      });

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
   * Get session details
   * Delegates to domain layer
   */
  async getSessionById(sessionId: string) {
    this.logger.debug(`Fetching class session details: sessionId=${sessionId}`);
    return this.domainClassSessionService.getSessionById(sessionId);
  }
}

