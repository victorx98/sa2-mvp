import { Inject, Injectable } from '@nestjs/common';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { resumes, type Resume } from '@infrastructure/database/schema';
import { IResumeRepository } from '../../repositories/resume.repository.interface';
import { ResumeEntity } from '../../entities/resume.entity';
import { ResumeMapper } from '../mappers/resume.mapper';

/**
 * Infrastructure - Resume Repository Implementation
 * 
 * Implements persistence operations for Resume entities
 */
@Injectable()
export class ResumeRepository implements IResumeRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  // Create resume
  async create(entity: ResumeEntity, tx?: DrizzleTransaction): Promise<ResumeEntity> {
    const db = tx || this.db;
    const data = ResumeMapper.toPersistence(entity);
    
    const [record] = await db.insert(resumes).values({
      ...data,
      id: entity.getId(),
      createdAt: entity.getCreatedAt(),
      updatedAt: entity.getUpdatedAt(),
    }).returning();
    
    return ResumeMapper.toDomain(record);
  }

  // Find by ID
  async findById(id: string, tx?: DrizzleTransaction): Promise<ResumeEntity | null> {
    const db = tx || this.db;
    const [record] = await db
      .select()
      .from(resumes)
      .where(eq(resumes.id, id))
      .limit(1);
    
    return record ? ResumeMapper.toDomain(record) : null;
  }

  // Find by student (only uploaded status)
  async findByStudent(studentUserId: string, tx?: DrizzleTransaction): Promise<ResumeEntity[]> {
    const db = tx || this.db;
    const records = await db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.studentUserId, studentUserId),
          eq(resumes.status, 'uploaded')
        )
      )
      .orderBy(resumes.createdAt);
    
    return records.map(ResumeMapper.toDomain);
  }

  // Find all resumes (all statuses) by student
  async findAllByStudent(studentUserId: string, tx?: DrizzleTransaction): Promise<ResumeEntity[]> {
    const db = tx || this.db;
    const records = await db
      .select()
      .from(resumes)
      .where(eq(resumes.studentUserId, studentUserId))
      .orderBy(resumes.createdAt);
    
    return records.map(ResumeMapper.toDomain);
  }

  // Find by mentor (final resumes)
  async findByMentor(mentorUserId: string, tx?: DrizzleTransaction): Promise<ResumeEntity[]> {
    const db = tx || this.db;
    const records = await db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.mentorUserId, mentorUserId),
          eq(resumes.status, 'final')
        )
      )
      .orderBy(resumes.createdAt);
    
    return records.map(ResumeMapper.toDomain);
  }

  // Find unbilled resumes by mentor
  async findUnbilledByMentor(mentorUserId: string, tx?: DrizzleTransaction): Promise<ResumeEntity[]> {
    const db = tx || this.db;
    const records = await db
      .select()
      .from(resumes)
      .where(
        and(
          eq(resumes.mentorUserId, mentorUserId),
          eq(resumes.status, 'final'),
          isNull(resumes.billedAt)
        )
      )
      .orderBy(resumes.createdAt);
    
    return records.map(ResumeMapper.toDomain);
  }

  // Update resume
  async update(entity: ResumeEntity, tx?: DrizzleTransaction): Promise<ResumeEntity> {
    const db = tx || this.db;
    const data = ResumeMapper.toPersistenceForUpdate(entity);
    
    const [record] = await db
      .update(resumes)
      .set(data)
      .where(eq(resumes.id, entity.getId()))
      .returning();
    
    if (!record) {
      throw new Error(`Resume with id ${entity.getId()} not found`);
    }
    
    return ResumeMapper.toDomain(record);
  }

  // Delete resume (soft delete)
  async delete(id: string, tx?: DrizzleTransaction): Promise<void> {
    const db = tx || this.db;
    await db
      .update(resumes)
      .set({
        status: 'deleted',
        updatedAt: new Date(),
      })
      .where(eq(resumes.id, id));
  }
}

