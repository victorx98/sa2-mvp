import { GapAnalysisSession } from '../entities/gap-analysis-session.entity';
import { SessionSearchCriteria } from './session-search.criteria';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Gap Analysis Repository Interface
 * 
 * Defines data access abstraction, using domain entities as parameters and return values
 */
export interface IGapAnalysisRepository {
  /**
   * Find session by ID
   */
  findById(id: string): Promise<GapAnalysisSession | null>;

  /**
   * Find session by meetingId
   */
  findByMeetingId(meetingId: string): Promise<GapAnalysisSession | null>;

  /**
   * Save session (create)
   */
  save(session: GapAnalysisSession, tx?: DrizzleTransaction): Promise<void>;

  /**
   * Update session
   */
  update(session: GapAnalysisSession, tx?: DrizzleTransaction): Promise<void>;

  /**
   * Search sessions
   */
  search(criteria: SessionSearchCriteria): Promise<GapAnalysisSession[]>;
}

/**
 * DI Token
 */
export const GAP_ANALYSIS_REPOSITORY = Symbol('GAP_ANALYSIS_REPOSITORY');

