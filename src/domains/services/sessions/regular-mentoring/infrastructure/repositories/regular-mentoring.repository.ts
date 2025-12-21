import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { regularMentoringSessions } from '@infrastructure/database/schema/regular-mentoring-sessions.schema';
import type { DrizzleDatabase, DrizzleTransaction, DrizzleExecutor } from '@shared/types/database.types';
import { IRegularMentoringRepository } from '../../repositories/regular-mentoring.repository.interface';
import { RegularMentoringSession } from '../../entities/regular-mentoring-session.entity';
import { SessionSearchCriteria } from '../../repositories/session-search.criteria';
import { RegularMentoringMapper } from '../mappers/regular-mentoring.mapper';

/**
 * Drizzle Regular Mentoring Repository
 * 
 * Implementation of IRegularMentoringRepository interface
 */
@Injectable()
export class DrizzleRegularMentoringRepository implements IRegularMentoringRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly mapper: RegularMentoringMapper,
  ) {}

  async findById(id: string): Promise<RegularMentoringSession | null> {
    const [record] = await this.db
      .select()
      .from(regularMentoringSessions)
      .where(eq(regularMentoringSessions.id, id))
      .limit(1);
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async findByMeetingId(meetingId: string): Promise<RegularMentoringSession | null> {
    const [record] = await this.db
      .select()
      .from(regularMentoringSessions)
      .where(eq(regularMentoringSessions.meetingId, meetingId))
      .limit(1);
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async save(session: RegularMentoringSession, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const data = this.mapper.toPersistence(session);
    
    await executor
      .insert(regularMentoringSessions)
      .values(data as any);
  }

  async update(session: RegularMentoringSession, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const data = this.mapper.toPersistence(session);
    
    await executor
      .update(regularMentoringSessions)
      .set(data)
      .where(eq(regularMentoringSessions.id, session.getId()));
  }

  async search(criteria: SessionSearchCriteria): Promise<RegularMentoringSession[]> {
    // TODO: Implement complex query logic
    const records = await this.db
      .select()
      .from(regularMentoringSessions)
      .limit(criteria.pageSize || 20);
    
    return records.map(record => this.mapper.toDomain(record));
  }
}

