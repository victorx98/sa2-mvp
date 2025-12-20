import { Inject, Injectable, Logger } from '@nestjs/common';
import { ICommSessionRepository, COMM_SESSION_REPOSITORY } from '../repositories/comm-session.repository.interface';
import { CommSession } from '../entities/comm-session.entity';
import { SessionStatus } from '../value-objects/session-status.vo';
import { SessionNotFoundException } from '../exceptions/exceptions';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Comm Session Domain Service
 * 
 * Responsibility: Pure business logic, no transactions, events, or external services
 * 
 * Key features:
 * - Does NOT register service to service_references (not billable)
 * - Does NOT emit services.session.completed event
 * - Simplified workflow: only updates comm_sessions status
 */
@Injectable()
export class CommSessionDomainService {
  private readonly logger = new Logger(CommSessionDomainService.name);

  constructor(
    @Inject(COMM_SESSION_REPOSITORY)
    private readonly repository: ICommSessionRepository,
  ) {}

  /**
   * Create session
   */
  async createSession(
    props: {
      id: string;
      sessionType: string;
      studentUserId: string;
      mentorUserId?: string;
      counselorUserId?: string;
      createdByCounselorId: string;
      title: string;
      description?: string;
      scheduledAt: Date;
    },
    tx?: DrizzleTransaction,
  ): Promise<CommSession> {
    this.logger.log(`Creating comm session for student ${props.studentUserId}`);
    
    const session = CommSession.create(props);
    await this.repository.save(session, tx);
    
    return session;
  }

  /**
   * Complete meeting setup (async flow)
   * PENDING_MEETING → SCHEDULED
   */
  async scheduleMeeting(
    sessionId: string,
    meetingId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Scheduling meeting for session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    session.scheduleMeeting(meetingId);
    await this.repository.update(session, tx);
  }

  /**
   * Mark meeting creation as failed
   * PENDING_MEETING → MEETING_FAILED
   */
  async markMeetingFailed(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Marking meeting failed for session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    session.markMeetingFailed();
    await this.repository.update(session, tx);
  }

  /**
   * Complete session
   * SCHEDULED → COMPLETED
   */
  async completeSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Completing session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    session.complete();
    await this.repository.update(session, tx);
  }

  /**
   * Cancel session
   * SCHEDULED/PENDING_MEETING/MEETING_FAILED → CANCELLED
   */
  async cancelSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Cancelling session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    session.cancel();
    await this.repository.update(session, tx);
  }

  /**
   * Update session information
   */
  async updateSession(
    sessionId: string,
    props: {
      title?: string;
      description?: string;
      scheduledAt?: Date;
    },
    tx?: DrizzleTransaction,
  ): Promise<CommSession> {
    this.logger.log(`Updating session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    session.updateInfo(props);
    await this.repository.update(session, tx);
    
    return session;
  }

  /**
   * Soft delete session
   */
  async deleteSession(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Deleting session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    session.softDelete();
    await this.repository.update(session, tx);
  }

  /**
   * Find session by meetingId
   */
  async findByMeetingId(meetingId: string): Promise<CommSession | null> {
    return this.repository.findByMeetingId(meetingId);
  }

  /**
   * Get session by ID
   */
  async getSessionById(id: string): Promise<CommSession> {
    const session = await this.repository.findById(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }
    return session;
  }
}

