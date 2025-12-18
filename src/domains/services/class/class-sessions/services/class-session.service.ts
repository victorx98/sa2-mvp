import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { ClassSessionRepository } from '../repositories/class-session.repository';
import { ClassRepository } from '../../classes/repositories/class.repository';
import { ClassSessionEntity, ClassSessionStatus, SessionType } from '../entities/class-session.entity';
import { CreateClassSessionDto } from '../dto/create-class-session.dto';
import { UpdateClassSessionDto } from '../dto/update-class-session.dto';
import { MeetingLifecycleCompletedPayload } from '@shared/events';
import { ServiceRegistryService } from '../../../service-registry/services/service-registry.service';
import { RegisterServiceDto } from '../../../service-registry/dto/register-service.dto';
import type { DrizzleTransaction } from '@shared/types/database.types';

@Injectable()
export class ClassSessionService {
  private readonly logger = new Logger(ClassSessionService.name);

  constructor(
    private readonly classSessionRepository: ClassSessionRepository,
    private readonly classRepository: ClassRepository,
    private readonly serviceRegistryService: ServiceRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create session (only create class_sessions record)
   * 1. Receive meetingId from App layer
   * 2. Validate classId validity
   * 3. Create class_sessions record
   */
  async createSession(dto: CreateClassSessionDto): Promise<ClassSessionEntity> {
    this.logger.log(`Creating class session: classId=${dto.classId}, meetingId=${dto.meetingId}`);

    // Verify class exists
    const classEntity = await this.classRepository.findByIdOrThrow(dto.classId);

    // Verify mentor is registered in this class
    const hasMentor = await this.classRepository.hasMentor(dto.classId, dto.mentorUserId);
    if (!hasMentor) {
      throw new BadRequestException(`Mentor ${dto.mentorUserId} is not registered in class ${dto.classId}`);
    }

    const entity = new ClassSessionEntity({
      id: uuidv4(),
      classId: dto.classId,
      meetingId: dto.meetingId,
      sessionType: SessionType.CLASS_SESSION,
      serviceType: dto.serviceType, // Business-level service type
      mentorUserId: dto.mentorUserId,
      createdByCounselorId: dto.createdByCounselorId,
      title: dto.title,
      description: dto.description,
      status: dto.status || (dto.meetingId ? ClassSessionStatus.SCHEDULED : ClassSessionStatus.PENDING_MEETING),
      scheduledAt: new Date(dto.scheduledAt),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await this.classSessionRepository.create(entity);
    this.logger.log(`Class session created successfully: ${result.id}`);

    return result;
  }

  /**
   * Update session information
   */
  async updateSession(
    id: string,
    dto: UpdateClassSessionDto,
    tx?: DrizzleTransaction,
  ): Promise<ClassSessionEntity> {
    this.logger.log(`Updating class session: ${id}`);

    const session = await this.classSessionRepository.findByIdOrThrow(id);

    // If changing mentor, need to verify new mentor is registered in class
    if (dto.mentorUserId && dto.mentorUserId !== session.mentorUserId) {
      const hasMentor = await this.classRepository.hasMentor(session.classId, dto.mentorUserId);
      if (!hasMentor) {
        throw new BadRequestException(
          `Mentor ${dto.mentorUserId} is not registered in class ${session.classId}`,
        );
      }
    }

    const updates: Partial<ClassSessionEntity> = {};
    if (dto.title) updates.title = dto.title;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.scheduledAt) updates.scheduledAt = new Date(dto.scheduledAt);
    if (dto.mentorUserId) updates.mentorUserId = dto.mentorUserId;

    const result = await this.classSessionRepository.update(id, updates, tx);
    this.logger.log(`Class session updated successfully: ${id}`);

    return result;
  }

  /**
   * Update meeting setup for async flow
   * Called after async meeting creation to update meeting_id and status
   *
   * @param sessionId - Session ID
   * @param meetingId - Meeting ID from MeetingManagerService.createMeeting()
   * @param tx - Optional transaction for atomicity
   */
  async updateMeetingSetup(
    sessionId: string,
    meetingId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Updating meeting setup for session ${sessionId} with meeting ${meetingId}`);

    await this.classSessionRepository.update(
      sessionId,
      {
        meetingId: meetingId,
        status: ClassSessionStatus.SCHEDULED,
      },
      tx,
    );

    this.logger.debug(`Meeting setup updated for session ${sessionId}`);
  }

  /**
   * Cancel session (only update status)
   * Calendar update and Meeting cancellation orchestrated by Application layer
   */
  async cancelSession(id: string, reason?: string): Promise<void> {
    this.logger.log(`Cancelling class session: ${id}, reason: ${reason}`);

    const session = await this.classSessionRepository.findByIdOrThrow(id);

    if (!session.isScheduled()) {
      throw new BadRequestException(`Session must be in scheduled status to cancel`);
    }

    session.cancel();
    await this.classSessionRepository.update(id, {
      status: session.status,
      cancelledAt: session.cancelledAt,
    });

    this.logger.log(`Class session cancelled successfully: ${id}`);
  }

  /**
   * Soft delete session
   */
  async deleteSession(id: string): Promise<void> {
    this.logger.log(`Soft deleting class session: ${id}`);

    const session = await this.classSessionRepository.findByIdOrThrow(id);
    session.softDelete();

    await this.classSessionRepository.update(id, {
      status: session.status,
      deletedAt: session.deletedAt,
    });

    this.logger.log(`Class session soft deleted successfully: ${id}`);
  }

  /**
   * Complete session (event-driven, called by listener)
   * 1. Update status = completed
   * 2. Set completed_at
   * 3. Register service to service_references (shared primary key)
   * 4. Emit SessionCompletedEvent
   */
  async completeSession(sessionId: string, payload: MeetingLifecycleCompletedPayload): Promise<void> {
    this.logger.log(`Completing class session: ${sessionId}`);

    const session = await this.classSessionRepository.findByIdOrThrow(sessionId);

    if (!session.isScheduled()) {
      this.logger.warn(`Session ${sessionId} is not in scheduled status, skipping completion`);
      return;
    }

    // Update session status
    session.complete();
    await this.classSessionRepository.update(sessionId, {
      status: session.status,
      completedAt: session.completedAt,
    });

    // Get class information to determine billing type
    const classEntity = await this.classRepository.findByIdOrThrow(session.classId);

    // Register service to Service Registry
    const actualDurationHours = Math.round((payload.actualDuration / 3600) * 100) / 100;
    const registerServiceDto: RegisterServiceDto = {
      id: sessionId,
      service_type: session.serviceType || 'class_session', // Prefer serviceType
      title: session.title, // Include session title
      student_user_id: null, // Class session scenario: student list managed by class_students table
      provider_user_id: session.mentorUserId,
      consumed_units: actualDurationHours,
      unit_type: 'hour',
      completed_time: payload.endedAt,
    };
    await this.serviceRegistryService.registerService(registerServiceDto);

    // Emit services.session.completed event
    const durationHours = Math.round((payload.scheduleDuration / 60) * 100) / 100;
    this.eventEmitter.emit('services.session.completed', {
      sessionId: sessionId,
      sessionType: 'class_session',
      classId: session.classId,
      classType: classEntity.type,
      mentorId: session.mentorUserId,
      refrenceId: sessionId, // shared primary key with service_references table
      actualDurationHours,
      durationHours,
      allowBilling: true, // All class sessions require mentor billing
    });

    this.logger.log(`Class session completed successfully: ${sessionId}`);
  }

  /**
   * Find session by meeting_id (for write operations)
   */
  async findByMeetingId(meetingId: string): Promise<ClassSessionEntity | null> {
    this.logger.log(`Finding class session by meeting ID: ${meetingId}`);
    return this.classSessionRepository.findByMeetingId(meetingId);
  }
}

