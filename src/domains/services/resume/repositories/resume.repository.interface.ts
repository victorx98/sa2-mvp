import type { DrizzleTransaction } from '@shared/types/database.types';
import { ResumeEntity } from '../entities/resume.entity';
import { ResumeStatus } from '../value-objects/resume-status.vo';

/**
 * Resume search criteria
 */
export interface ResumeSearchCriteria {
  studentUserId?: string;
  status?: ResumeStatus;
  mentorUserId?: string;
  hasMentor?: boolean;
  includeDeleted?: boolean;
}

/**
 * Resume Repository Interface
 * 
 * Defines contract for resume persistence operations
 */
export interface IResumeRepository {
  create(resume: ResumeEntity, tx?: DrizzleTransaction): Promise<ResumeEntity>;
  
  findById(id: string, tx?: DrizzleTransaction): Promise<ResumeEntity | null>;
  
  findByStudent(studentUserId: string, tx?: DrizzleTransaction): Promise<ResumeEntity[]>;
  
  findAllByStudent(studentUserId: string, tx?: DrizzleTransaction): Promise<ResumeEntity[]>;
  
  findByMentor(mentorUserId: string, tx?: DrizzleTransaction): Promise<ResumeEntity[]>;
  
  findUnbilledByMentor(mentorUserId: string, tx?: DrizzleTransaction): Promise<ResumeEntity[]>;
  
  update(resume: ResumeEntity, tx?: DrizzleTransaction): Promise<ResumeEntity>;
  
  delete(id: string, tx?: DrizzleTransaction): Promise<void>;
}

// DI token for repository
export const RESUME_REPOSITORY = Symbol('RESUME_REPOSITORY');

