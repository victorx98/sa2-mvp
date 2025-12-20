import { CommSession } from '../entities/comm-session.entity';
import { SessionSearchCriteria } from './session-search.criteria';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Comm Session Repository Interface
 * 
 * Defines data access abstraction, using domain entities as parameters and return values
 */
export interface ICommSessionRepository {
  /**
   * Find session by ID
   */
  findById(id: string): Promise<CommSession | null>;

  /**
   * Find session by meetingId
   */
  findByMeetingId(meetingId: string): Promise<CommSession | null>;

  /**
   * Save session (create)
   */
  save(session: CommSession, tx?: DrizzleTransaction): Promise<void>;

  /**
   * Update session
   */
  update(session: CommSession, tx?: DrizzleTransaction): Promise<void>;

  /**
   * Search sessions
   */
  search(criteria: SessionSearchCriteria): Promise<CommSession[]>;
}

/**
 * DI Token
 */
export const COMM_SESSION_REPOSITORY = Symbol('COMM_SESSION_REPOSITORY');

