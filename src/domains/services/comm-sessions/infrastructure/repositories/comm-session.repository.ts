import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { commSessions } from '@infrastructure/database/schema/comm-sessions.schema';
import type { DrizzleDatabase, DrizzleTransaction, DrizzleExecutor } from '@shared/types/database.types';
import { ICommSessionRepository } from '../../repositories/comm-session.repository.interface';
import { CommSession } from '../../entities/comm-session.entity';
import { SessionSearchCriteria } from '../../repositories/session-search.criteria';
import { CommSessionMapper } from '../mappers/comm-session.mapper';

/**
 * Drizzle Comm Session Repository
 * 
 * Implementation of ICommSessionRepository interface
 */
@Injectable()
export class DrizzleCommSessionRepository implements ICommSessionRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly mapper: CommSessionMapper,
  ) {}

  async findById(id: string): Promise<CommSession | null> {
    const [record] = await this.db
      .select()
      .from(commSessions)
      .where(eq(commSessions.id, id))
      .limit(1);
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async findByMeetingId(meetingId: string): Promise<CommSession | null> {
    const [record] = await this.db
      .select()
      .from(commSessions)
      .where(eq(commSessions.meetingId, meetingId))
      .limit(1);
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async save(session: CommSession, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const data = this.mapper.toPersistence(session);
    
    await executor
      .insert(commSessions)
      .values(data as any);
  }

  async update(session: CommSession, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const data = this.mapper.toPersistence(session);
    
    await executor
      .update(commSessions)
      .set(data)
      .where(eq(commSessions.id, session.getId()));
  }

  async search(criteria: SessionSearchCriteria): Promise<CommSession[]> {
    // TODO: Implement complex query logic
    const records = await this.db
      .select()
      .from(commSessions)
      .limit(criteria.pageSize || 20);
    
    return records.map(record => this.mapper.toDomain(record));
  }
}

