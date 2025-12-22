import { RegularMentoringSession } from '../entities/regular-mentoring-session.entity';
import { SessionSearchCriteria } from './session-search.criteria';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Regular Mentoring Repository Interface
 * 
 * Defines data access abstraction, using domain entities as parameters and return values
 */
export interface IRegularMentoringRepository {
  /**
   * Find session by ID
   */
  findById(id: string): Promise<RegularMentoringSession | null>;

  /**
   * Find session by meetingId
   */
  findByMeetingId(meetingId: string): Promise<RegularMentoringSession | null>;

  /**
   * Save session (create)
   */
  save(session: RegularMentoringSession, tx?: DrizzleTransaction): Promise<void>;

  /**
   * Update session
   */
  update(session: RegularMentoringSession, tx?: DrizzleTransaction): Promise<void>;

  /**
   * Search sessions
   */
  search(criteria: SessionSearchCriteria): Promise<RegularMentoringSession[]>;
}

/**
 * DI Token
 */
export const REGULAR_MENTORING_REPOSITORY = Symbol('REGULAR_MENTORING_REPOSITORY');

