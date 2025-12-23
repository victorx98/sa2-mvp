import { MockInterview } from '../entities/mock-interview.entity';
import type { DrizzleTransaction } from '@shared/types/database.types';

export const MOCK_INTERVIEW_REPOSITORY = Symbol('MOCK_INTERVIEW_REPOSITORY');

/**
 * Mock Interview Repository Interface
 * Defines data access methods
 */
export interface IMockInterviewRepository {
  /**
   * Save new interview
   */
  save(interview: MockInterview, tx?: DrizzleTransaction): Promise<void>;

  /**
   * Update existing interview
   */
  update(interview: MockInterview, tx?: DrizzleTransaction): Promise<void>;

  /**
   * Find interview by ID
   */
  findById(id: string): Promise<MockInterview | null>;

  /**
   * Find interviews by student ID
   */
  findByStudentId(studentId: string): Promise<MockInterview[]>;
}

