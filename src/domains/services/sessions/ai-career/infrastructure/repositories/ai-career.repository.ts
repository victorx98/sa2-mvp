import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { aiCareerSessions } from '@infrastructure/database/schema/ai-career-sessions.schema';
import type { DrizzleDatabase, DrizzleTransaction, DrizzleExecutor } from '@shared/types/database.types';
import { IAiCareerRepository } from '../../repositories/ai-career.repository.interface';
import { AiCareerSession } from '../../entities/ai-career-session.entity';
import { SessionSearchCriteria } from '../../repositories/session-search.criteria';
import { AiCareerMapper } from '../mappers/ai-career.mapper';

/**
 * Drizzle AI Career Repository
 * 
 * Implementation of IAiCareerRepository interface
 */
@Injectable()
export class DrizzleAiCareerRepository implements IAiCareerRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly mapper: AiCareerMapper,
  ) {}

  async findById(id: string): Promise<AiCareerSession | null> {
    const [record] = await this.db
      .select()
      .from(aiCareerSessions)
      .where(eq(aiCareerSessions.id, id))
      .limit(1);
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async findByMeetingId(meetingId: string): Promise<AiCareerSession | null> {
    const [record] = await this.db
      .select()
      .from(aiCareerSessions)
      .where(eq(aiCareerSessions.meetingId, meetingId))
      .limit(1);
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async save(session: AiCareerSession, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const data = this.mapper.toPersistence(session);
    
    await executor
      .insert(aiCareerSessions)
      .values(data as any);
  }

  async update(session: AiCareerSession, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const data = this.mapper.toPersistence(session);
    
    await executor
      .update(aiCareerSessions)
      .set(data)
      .where(eq(aiCareerSessions.id, session.getId()));
  }

  async search(criteria: SessionSearchCriteria): Promise<AiCareerSession[]> {
    // TODO: Implement complex query logic
    const records = await this.db
      .select()
      .from(aiCareerSessions)
      .limit(criteria.pageSize || 20);
    
    return records.map(record => this.mapper.toDomain(record));
  }
}

