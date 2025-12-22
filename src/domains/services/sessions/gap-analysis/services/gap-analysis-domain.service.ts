import { Inject, Injectable, Logger } from '@nestjs/common';
import { IGapAnalysisRepository, GAP_ANALYSIS_REPOSITORY } from '../repositories/gap-analysis.repository.interface';
import { GapAnalysisSession } from '../entities/gap-analysis-session.entity';
import { SessionStatus } from '../value-objects/session-status.vo';
import { SessionNotFoundException } from '../exceptions/exceptions';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Gap Analysis Domain Service
 * 
 * Responsibility: Pure business logic, no transactions, events, or external services
 */
@Injectable()
export class GapAnalysisDomainService {
  private readonly logger = new Logger(GapAnalysisDomainService.name);

  constructor(
    @Inject(GAP_ANALYSIS_REPOSITORY)
    private readonly repository: IGapAnalysisRepository,
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
  ): Promise<GapAnalysisSession> {
    this.logger.log(`Creating session for student ${props.studentUserId}`);
    
    // Create entity
    const session = GapAnalysisSession.create(props);
    
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
  ): Promise<GapAnalysisSession> {
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
  async findByMeetingId(meetingId: string): Promise<GapAnalysisSession | null> {
    return this.repository.findByMeetingId(meetingId);
  }

  /**
   * Get session by ID
   */
  async getSessionById(id: string): Promise<GapAnalysisSession> {
    const session = await this.repository.findById(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }
    return session;
  }
}

