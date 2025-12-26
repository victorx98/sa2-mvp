import { Inject, Injectable, Logger } from '@nestjs/common';
import { IRegularMentoringRepository, REGULAR_MENTORING_REPOSITORY } from '../repositories/regular-mentoring.repository.interface';
import { RegularMentoringSession } from '../entities/regular-mentoring-session.entity';
import { SessionStatus } from '../value-objects/session-status.vo';
import { SessionNotFoundException } from '../exceptions/exceptions';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Regular Mentoring Domain Service
 * 
 * Responsibility: Pure business logic, no transactions, events, or external services
 */
@Injectable()
export class RegularMentoringDomainService {
  private readonly logger = new Logger(RegularMentoringDomainService.name);

  constructor(
    @Inject(REGULAR_MENTORING_REPOSITORY)
    private readonly repository: IRegularMentoringRepository,
  ) {}

  /**
   * Create session
   */
  async createSession(
    props: {
      id: string;
      sessionType: string;
      sessionTypeId: string;
      serviceType?: string;
      serviceHoldId?: string;
      studentUserId: string;
      mentorUserId: string;
      createdByCounselorId: string;
      title: string;
      description?: string;
      scheduledAt: Date;
    },
    tx?: DrizzleTransaction,
  ): Promise<RegularMentoringSession> {
    this.logger.log(`Creating session for student ${props.studentUserId}`);
    
    // Create entity
    const session = RegularMentoringSession.create(props);
    
    // Save
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
    
    // Query entity
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    // Call entity method (business rules inside entity)
    session.scheduleMeeting(meetingId);
    
    // Save
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
   * SCHEDULED/PENDING_MEETING → CANCELLED
   */
  async cancelSession(
    sessionId: string,
    reason?: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    this.logger.log(`Cancelling session ${sessionId}`);
    
    const session = await this.repository.findById(sessionId);
    if (!session) {
      throw new SessionNotFoundException(sessionId);
    }
    
    // Update description with cancellation reason if provided
    if (reason) {
      session.updateInfo({ description: reason });
    }
    
    session.cancel();
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
  ): Promise<RegularMentoringSession> {
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
   * Get session by ID
   */
  async getSessionById(id: string): Promise<RegularMentoringSession> {
    const session = await this.repository.findById(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }
    return session;
  }

  /**
   * Find session by meetingId
   */
  async findByMeetingId(meetingId: string): Promise<RegularMentoringSession | null> {
    return this.repository.findByMeetingId(meetingId);
  }
}
