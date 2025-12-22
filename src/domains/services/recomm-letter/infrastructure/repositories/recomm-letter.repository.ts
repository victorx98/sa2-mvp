import { Inject, Injectable } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { recommLetters } from '@infrastructure/database/schema';
import { IRecommLetterRepository } from '../../repositories/recomm-letter.repository.interface';
import { RecommLetterEntity } from '../../entities/recomm-letter.entity';
import { RecommLetterMapper } from '../mappers/recomm-letter.mapper';

/**
 * Infrastructure - Recommendation Letter Repository Implementation
 * 
 * Implements persistence operations for Recommendation Letter entities
 */
@Injectable()
export class RecommLetterRepository implements IRecommLetterRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  // Create recommendation letter
  async create(entity: RecommLetterEntity, tx?: DrizzleTransaction): Promise<RecommLetterEntity> {
    const db = tx || this.db;
    const data = RecommLetterMapper.toPersistence(entity);
    
    const [record] = await db.insert(recommLetters).values({
      ...data,
      id: entity.getId(),
      createdAt: entity.getCreatedAt(),
      updatedAt: entity.getUpdatedAt(),
    }).returning();
    
    return RecommLetterMapper.toDomain(record);
  }

  // Find by ID
  async findById(id: string, tx?: DrizzleTransaction): Promise<RecommLetterEntity | null> {
    const db = tx || this.db;
    const [record] = await db
      .select()
      .from(recommLetters)
      .where(eq(recommLetters.id, id))
      .limit(1);
    
    return record ? RecommLetterMapper.toDomain(record) : null;
  }

  // Find all letters (all statuses) by student
  async findAllByStudent(studentUserId: string, tx?: DrizzleTransaction): Promise<RecommLetterEntity[]> {
    const db = tx || this.db;
    const records = await db
      .select()
      .from(recommLetters)
      .where(eq(recommLetters.studentUserId, studentUserId))
      .orderBy(recommLetters.createdAt);
    
    return records.map(RecommLetterMapper.toDomain);
  }

  // Find by mentor (billed letters)
  async findByMentor(mentorUserId: string, tx?: DrizzleTransaction): Promise<RecommLetterEntity[]> {
    const db = tx || this.db;
    const records = await db
      .select()
      .from(recommLetters)
      .where(
        and(
          eq(recommLetters.mentorUserId, mentorUserId),
          eq(recommLetters.status, 'uploaded')
        )
      )
      .orderBy(recommLetters.createdAt);
    
    return records.map(RecommLetterMapper.toDomain);
  }

  // Find unbilled letters by mentor
  async findUnbilledByMentor(mentorUserId: string, tx?: DrizzleTransaction): Promise<RecommLetterEntity[]> {
    const db = tx || this.db;
    const records = await db
      .select()
      .from(recommLetters)
      .where(
        and(
          eq(recommLetters.mentorUserId, mentorUserId),
          eq(recommLetters.status, 'uploaded'),
          isNull(recommLetters.billedAt)
        )
      )
      .orderBy(recommLetters.createdAt);
    
    return records.map(RecommLetterMapper.toDomain);
  }

  // Update recommendation letter
  async update(entity: RecommLetterEntity, tx?: DrizzleTransaction): Promise<RecommLetterEntity> {
    const db = tx || this.db;
    const data = RecommLetterMapper.toPersistenceForUpdate(entity);
    
    const [record] = await db
      .update(recommLetters)
      .set(data)
      .where(eq(recommLetters.id, entity.getId()))
      .returning();
    
    if (!record) {
      throw new Error(`Recommendation letter with id ${entity.getId()} not found`);
    }
    
    return RecommLetterMapper.toDomain(record);
  }

  // Delete recommendation letter (soft delete)
  async delete(id: string, tx?: DrizzleTransaction): Promise<void> {
    const db = tx || this.db;
    await db
      .update(recommLetters)
      .set({
        status: 'deleted',
        updatedAt: new Date(),
      })
      .where(eq(recommLetters.id, id));
  }
}

