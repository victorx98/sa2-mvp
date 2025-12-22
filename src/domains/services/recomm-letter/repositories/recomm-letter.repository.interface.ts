import type { DrizzleTransaction } from '@shared/types/database.types';
import { RecommLetterEntity } from '../entities/recomm-letter.entity';
import { RecommLetterStatus } from '../value-objects/recomm-letter-status.vo';

/**
 * Recommendation Letter search criteria
 */
export interface RecommLetterSearchCriteria {
  studentUserId?: string;
  status?: RecommLetterStatus;
  mentorUserId?: string;
  hasMentor?: boolean;
  includeDeleted?: boolean;
}

/**
 * Recommendation Letter Repository Interface
 * 
 * Defines contract for recommendation letter persistence operations
 */
export interface IRecommLetterRepository {
  create(letter: RecommLetterEntity, tx?: DrizzleTransaction): Promise<RecommLetterEntity>;
  
  findById(id: string, tx?: DrizzleTransaction): Promise<RecommLetterEntity | null>;
  
  findAllByStudent(studentUserId: string, tx?: DrizzleTransaction): Promise<RecommLetterEntity[]>;
  
  findByMentor(mentorUserId: string, tx?: DrizzleTransaction): Promise<RecommLetterEntity[]>;
  
  findUnbilledByMentor(mentorUserId: string, tx?: DrizzleTransaction): Promise<RecommLetterEntity[]>;
  
  update(letter: RecommLetterEntity, tx?: DrizzleTransaction): Promise<RecommLetterEntity>;
  
  delete(id: string, tx?: DrizzleTransaction): Promise<void>;
}

// DI token for repository
export const RECOMM_LETTER_REPOSITORY = Symbol('RECOMM_LETTER_REPOSITORY');

