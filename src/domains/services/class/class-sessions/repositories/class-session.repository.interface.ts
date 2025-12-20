import { ClassSessionEntity } from '../entities/class-session.entity';
import { SessionStatus } from '../value-objects/session-status.vo';
import type { DrizzleTransaction } from '@shared/types/database.types';

/**
 * Repository Interface - Class Session
 * Defines contract for data access operations
 */
export interface IClassSessionRepository {
  create(entity: ClassSessionEntity, tx?: DrizzleTransaction): Promise<ClassSessionEntity>;
  findById(id: string): Promise<ClassSessionEntity | null>;
  findByIdOrThrow(id: string): Promise<ClassSessionEntity>;
  findByMeetingId(meetingId: string): Promise<ClassSessionEntity | null>;
  findByClass(
    classId: string,
    limit?: number,
    offset?: number,
    filters?: {
      status?: SessionStatus;
      excludeDeleted?: boolean;
    }
  ): Promise<ClassSessionEntity[]>;
  findByMentor(
    mentorId: string,
    limit?: number,
    offset?: number,
    filters?: {
      status?: SessionStatus;
      excludeDeleted?: boolean;
    }
  ): Promise<ClassSessionEntity[]>;
  update(
    id: string,
    entity: Partial<ClassSessionEntity>,
    tx?: DrizzleTransaction
  ): Promise<ClassSessionEntity>;
  save(entity: ClassSessionEntity, tx?: DrizzleTransaction): Promise<ClassSessionEntity>;
}

export const CLASS_SESSION_REPOSITORY = Symbol('CLASS_SESSION_REPOSITORY');

