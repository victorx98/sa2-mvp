import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { recommLetterTypes } from '@infrastructure/database/schema/recomm-letter-types.schema';
import { IRecommLetterTypesRepository } from '../../repositories/recomm-letter-types.repository.interface';
import type { RecommLetterTypeEntity } from '../../entities/recomm-letter-type.entity';

/**
 * Recommendation Letter Types Repository Implementation
 * 
 * Drizzle ORM implementation of recommendation letter types data access
 */
@Injectable()
export class RecommLetterTypesRepository implements IRecommLetterTypesRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async findAll(): Promise<RecommLetterTypeEntity[]> {
    return this.db.query.recommLetterTypes.findMany({
      where: eq(recommLetterTypes.active, true),
    });
  }

  async findById(id: string): Promise<RecommLetterTypeEntity | null> {
    const result = await this.db.query.recommLetterTypes.findFirst({
      where: eq(recommLetterTypes.id, id),
    });
    return result || null;
  }

  async findByTypeCode(typeCode: string): Promise<RecommLetterTypeEntity | null> {
    const result = await this.db.query.recommLetterTypes.findFirst({
      where: eq(recommLetterTypes.typeCode, typeCode),
    });
    return result || null;
  }

  async findByServiceTypeCode(serviceTypeCode: string): Promise<RecommLetterTypeEntity[]> {
    return this.db.query.recommLetterTypes.findMany({
      where: eq(recommLetterTypes.serviceTypeCode, serviceTypeCode),
    });
  }

  async create(data: Partial<RecommLetterTypeEntity>): Promise<RecommLetterTypeEntity> {
    const [result] = await this.db
      .insert(recommLetterTypes)
      .values(data as any)
      .returning();
    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(recommLetterTypes)
      .where(eq(recommLetterTypes.id, id));
  }
}

