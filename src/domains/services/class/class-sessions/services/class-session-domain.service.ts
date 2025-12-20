import { Injectable, Logger, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClassSessionEntity, SessionType } from '../entities/class-session.entity';
import { SessionStatus } from '../value-objects/session-status.vo';
import { IClassSessionRepository, CLASS_SESSION_REPOSITORY } from '../repositories/class-session.repository.interface';
import { MentorNotAssignedToClassException } from '../exceptions/exceptions';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Domain Service - Class Session
 * Pure business logic without external dependencies
 */
@Injectable()
export class ClassSessionDomainService {
  private readonly logger = new Logger(ClassSessionDomainService.name);

  constructor(
    @Inject(CLASS_SESSION_REPOSITORY)
    private readonly repository: IClassSessionRepository,
  ) {}

  /**
   * Create a new class session entity
   */
  async createSession(data: {
    classId: string;
    meetingId: string;
    mentorUserId: string;
    createdByCounselorId?: string;
    title: string;
    description?: string;
    scheduledAt: Date;
    serviceType?: string;
    status?: SessionStatus;
  }, tx?: DrizzleTransaction): Promise<ClassSessionEntity> {
    this.logger.log(`Creating class session for class: ${data.classId}`);

    const entity = new ClassSessionEntity({
      id: randomUUID(),
      classId: data.classId,
      meetingId: data.meetingId,
      sessionType: SessionType.CLASS_SESSION,
      serviceType: data.serviceType,
      mentorUserId: data.mentorUserId,
      createdByCounselorId: data.createdByCounselorId,
      title: data.title,
      description: data.description,
      status: data.status || (data.meetingId ? SessionStatus.SCHEDULED : SessionStatus.PENDING_MEETING),
      scheduledAt: data.scheduledAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await this.repository.create(entity, tx);
    this.logger.log(`Class session created: ${result.getId()}`);

    return result;
  }

  /**
   * Update session details
   */
  async updateSession(
    sessionId: string,
    data: {
      title?: string;
      description?: string;
      scheduledAt?: Date;
      mentorUserId?: string;
    },
    tx?: DrizzleTransaction,
  ): Promise<ClassSessionEntity> {
    this.logger.log(`Updating class session: ${sessionId}`);

    const session = await this.repository.findByIdOrThrow(sessionId);
    session.updateDetails(data);

    const result = await this.repository.save(session, tx);
    this.logger.log(`Class session updated: ${sessionId}`);

    return result;
  }

  /**
   * Mark session as scheduled after meeting creation
   */
  async markAsScheduled(
    sessionId: string,
    meetingId: string,
    tx?: DrizzleTransaction,
  ): Promise<ClassSessionEntity> {
    this.logger.log(`Marking session as scheduled: ${sessionId}`);

    const session = await this.repository.findByIdOrThrow(sessionId);
    session.markAsScheduled(meetingId);

    const result = await this.repository.save(session, tx);
    this.logger.log(`Session marked as scheduled: ${sessionId}`);

    return result;
  }

  /**
   * Complete session
   */
  async completeSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<ClassSessionEntity> {
    this.logger.log(`Completing class session: ${sessionId}`);

    const session = await this.repository.findByIdOrThrow(sessionId);
    session.complete();

    const result = await this.repository.save(session, tx);
    this.logger.log(`Class session completed: ${sessionId}`);

    return result;
  }

  /**
   * Cancel session
   */
  async cancelSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<ClassSessionEntity> {
    this.logger.log(`Cancelling class session: ${sessionId}`);

    const session = await this.repository.findByIdOrThrow(sessionId);
    session.cancel();

    const result = await this.repository.save(session, tx);
    this.logger.log(`Class session cancelled: ${sessionId}`);

    return result;
  }

  /**
   * Mark meeting creation as failed
   */
  async markMeetingFailed(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<ClassSessionEntity> {
    this.logger.log(`Marking meeting failed for session: ${sessionId}`);

    const session = await this.repository.findByIdOrThrow(sessionId);
    session.markMeetingFailed();

    const result = await this.repository.save(session, tx);
    this.logger.log(`Session marked as meeting failed: ${sessionId}`);

    return result;
  }

  /**
   * Soft delete session
   */
  async deleteSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<ClassSessionEntity> {
    this.logger.log(`Soft deleting class session: ${sessionId}`);

    const session = await this.repository.findByIdOrThrow(sessionId);
    session.softDelete();

    const result = await this.repository.save(session, tx);
    this.logger.log(`Class session soft deleted: ${sessionId}`);

    return result;
  }

  /**
   * Find session by ID
   */
  async findById(sessionId: string): Promise<ClassSessionEntity | null> {
    return this.repository.findById(sessionId);
  }

  /**
   * Find session by meeting ID
   */
  async findByMeetingId(meetingId: string): Promise<ClassSessionEntity | null> {
    return this.repository.findByMeetingId(meetingId);
  }
}

