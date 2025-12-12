import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CommSessionRepository } from '../repositories/comm-session.repository';
import { CommSessionEntity, CommSessionStatus, CommSessionType } from '../entities/comm-session.entity';
import { CreateCommSessionDto } from '../dto/create-comm-session.dto';
import { UpdateCommSessionDto } from '../dto/update-comm-session.dto';
import { MeetingLifecycleCompletedPayload } from '@shared/events';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Comm Session Service
 *
 * Domain service for managing internal communication sessions
 * Key features:
 * - Does NOT register service to service_references (not billable)
 * - Does NOT emit services.session.completed event
 * - Simplified workflow: only updates comm_sessions status
 */
@Injectable()
export class CommSessionService {
  private readonly logger = new Logger(CommSessionService.name);

  constructor(private readonly commSessionRepository: CommSessionRepository) {}

  /**
   * Create comm session
   *
   * @param dto - Create DTO with meeting ID from App layer
   * @returns Created session entity
   */
  async createSession(dto: CreateCommSessionDto): Promise<CommSessionEntity> {
    this.logger.log(
      `Creating comm session: meetingId=${dto.meetingId}, studentUserId=${dto.studentUserId}`,
    );

    const entity = new CommSessionEntity({
      id: uuidv4(),
      meetingId: dto.meetingId || null,
      sessionType: CommSessionType.COMM_SESSION,
      studentUserId: dto.studentUserId,
      mentorUserId: dto.mentorUserId || undefined,
      counselorUserId: dto.counselorUserId || undefined,
      createdByCounselorId: dto.createdByCounselorId,
      title: dto.title,
      description: dto.description,
      status: dto.status || CommSessionStatus.PENDING_MEETING,
      scheduledAt: new Date(dto.scheduledAt),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await this.commSessionRepository.create(entity);
    this.logger.log(`Comm session created successfully: ${result.id}`);

    return result;
  }

  /**
   * Update session information
   *
   * @param id - Session ID
   * @param dto - Update DTO with fields to update
   * @returns Updated session entity
   */
  async updateSession(id: string, dto: UpdateCommSessionDto): Promise<CommSessionEntity> {
    this.logger.log(`Updating comm session: ${id}`);

    const session = await this.commSessionRepository.findByIdOrThrow(id);

    const updates: Partial<CommSessionEntity> = {};
    if (dto.title) updates.title = dto.title;
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.scheduledAt) updates.scheduledAt = new Date(dto.scheduledAt);

    const result = await this.commSessionRepository.update(id, updates);
    this.logger.log(`Comm session updated successfully: ${id}`);

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

    await this.commSessionRepository.update(
      sessionId,
      {
        meetingId: meetingId,
        status: CommSessionStatus.SCHEDULED,
      },
      tx,
    );

    this.logger.debug(`Meeting setup updated for session ${sessionId}`);
  }

  /**
   * Cancel session
   *
   * @param id - Session ID
   * @param reason - Cancellation reason (optional)
   *
   * Note: Calendar update and Meeting cancellation orchestrated by Application layer
   */
  async cancelSession(id: string, reason?: string): Promise<void> {
    this.logger.log(`Cancelling comm session: ${id}, reason: ${reason}`);

    const session = await this.commSessionRepository.findByIdOrThrow(id);

    if (!session.isScheduled()) {
      throw new BadRequestException(`Session must be in scheduled status to cancel`);
    }

    session.cancel();
    await this.commSessionRepository.update(id, {
      status: session.status,
      cancelledAt: session.cancelledAt,
    });

    this.logger.log(`Comm session cancelled successfully: ${id}`);
  }

  /**
   * Soft delete session
   *
   * @param id - Session ID
   */
  async deleteSession(id: string): Promise<void> {
    this.logger.log(`Soft deleting comm session: ${id}`);

    const session = await this.commSessionRepository.findByIdOrThrow(id);
    session.softDelete();

    await this.commSessionRepository.update(id, {
      status: session.status,
      deletedAt: session.deletedAt,
    });

    this.logger.log(`Comm session soft deleted successfully: ${id}`);
  }

  /**
   * Complete session
   *
   * Event-driven (called by listener)
   * Responsibilities:
   * 1. Update status = completed
   * 2. Set completed_at
   *
   * NOTE: Does NOT register service, does NOT emit completion event
   * This is what distinguishes comm_session from other session types
   *
   * @param sessionId - Session ID
   * @param payload - Meeting lifecycle completed payload
   */
  async completeSession(
    sessionId: string,
    payload: MeetingLifecycleCompletedPayload,
  ): Promise<void> {
    this.logger.log(`Completing comm session: ${sessionId}`);

    const session = await this.commSessionRepository.findByIdOrThrow(sessionId);

    if (!session.isScheduled()) {
      this.logger.warn(`Session ${sessionId} is not in scheduled status, skipping completion`);
      return;
    }

    // Update session status only
    session.complete();
    await this.commSessionRepository.update(sessionId, {
      status: session.status,
      completedAt: session.completedAt,
    });

    // NOTE: NOT calling ServiceRegistryService.registerService()
    // NOTE: NOT emitting services.session.completed event
    // These are intentionally omitted as comm_session is not billable and downstream services do not depend on it

    this.logger.log(`Comm session completed successfully: ${sessionId}`);
  }

  /**
   * Find session by meeting ID (for write operations)
   *
   * @param meetingId - Meeting ID
   * @returns Session entity or null
   */
  async findByMeetingId(meetingId: string): Promise<CommSessionEntity | null> {
    this.logger.log(`Finding comm session by meeting ID: ${meetingId}`);
    return this.commSessionRepository.findByMeetingId(meetingId);
  }
}

