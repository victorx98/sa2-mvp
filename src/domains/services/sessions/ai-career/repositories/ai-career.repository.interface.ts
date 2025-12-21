import { AiCareerSession } from '../entities/ai-career-session.entity';
import { SessionSearchCriteria } from './session-search.criteria';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * AI Career Repository Interface
 * 
 * Defines data access abstraction, using domain entities as parameters and return values
 */
export interface IAiCareerRepository {
  /**
   * Find session by ID
   */
  findById(id: string): Promise<AiCareerSession | null>;

  /**
   * Find session by meetingId
   */
  findByMeetingId(meetingId: string): Promise<AiCareerSession | null>;

  /**
   * Save session (create)
   */
  save(session: AiCareerSession, tx?: DrizzleTransaction): Promise<void>;

  /**
   * Update session
   */
  update(session: AiCareerSession, tx?: DrizzleTransaction): Promise<void>;

  /**
   * Search sessions
   */
  search(criteria: SessionSearchCriteria): Promise<AiCareerSession[]>;
}

/**
 * DI Token
 */
export const AI_CAREER_REPOSITORY = Symbol('AI_CAREER_REPOSITORY');

