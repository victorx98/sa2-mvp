import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { sessionTypes } from '@infrastructure/database/schema/session-types.schema';
import type { SessionTypeEntity } from './entities/session-type.entity';

@Injectable()
export class SessionTypesRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  async findOne(id: string): Promise<SessionTypeEntity | null> {
    const result = await this.db.query.sessionTypes.findFirst({
      where: eq(sessionTypes.id, id),
    });
    return result || null;
  }

  async findByCode(code: string): Promise<SessionTypeEntity[]> {
    return this.db.query.sessionTypes.findMany({
      where: eq(sessionTypes.code, code),
    });
  }

  async findAll(): Promise<SessionTypeEntity[]> {
    const results = await this.db.query.sessionTypes.findMany();
    return results as SessionTypeEntity[];
  }

  async create(data: Partial<SessionTypeEntity>): Promise<SessionTypeEntity> {
    const [result] = await this.db
      .insert(sessionTypes)
      .values(data as any)
      .returning();
    return result;
  }
}

