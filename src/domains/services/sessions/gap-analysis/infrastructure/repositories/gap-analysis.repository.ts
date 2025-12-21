import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { gapAnalysisSessions } from '@infrastructure/database/schema/gap-analysis-sessions.schema';
import type { DrizzleDatabase, DrizzleTransaction, DrizzleExecutor } from '@shared/types/database.types';
import { IGapAnalysisRepository } from '../../repositories/gap-analysis.repository.interface';
import { GapAnalysisSession } from '../../entities/gap-analysis-session.entity';
import { SessionSearchCriteria } from '../../repositories/session-search.criteria';
import { GapAnalysisMapper } from '../mappers/gap-analysis.mapper';

/**
 * Drizzle Gap Analysis Repository
 * 
 * Implementation of IGapAnalysisRepository interface
 */
@Injectable()
export class DrizzleGapAnalysisRepository implements IGapAnalysisRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly mapper: GapAnalysisMapper,
  ) {}

  async findById(id: string): Promise<GapAnalysisSession | null> {
    const [record] = await this.db
      .select()
      .from(gapAnalysisSessions)
      .where(eq(gapAnalysisSessions.id, id))
      .limit(1);
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async findByMeetingId(meetingId: string): Promise<GapAnalysisSession | null> {
    const [record] = await this.db
      .select()
      .from(gapAnalysisSessions)
      .where(eq(gapAnalysisSessions.meetingId, meetingId))
      .limit(1);
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async save(session: GapAnalysisSession, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const data = this.mapper.toPersistence(session);
    
    await executor
      .insert(gapAnalysisSessions)
      .values(data as any);
  }

  async update(session: GapAnalysisSession, tx?: DrizzleTransaction): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const data = this.mapper.toPersistence(session);
    
    await executor
      .update(gapAnalysisSessions)
      .set(data)
      .where(eq(gapAnalysisSessions.id, session.getId()));
  }

  async search(criteria: SessionSearchCriteria): Promise<GapAnalysisSession[]> {
    // TODO: Implement complex query logic
    const records = await this.db
      .select()
      .from(gapAnalysisSessions)
      .limit(criteria.pageSize || 20);
    
    return records.map(record => this.mapper.toDomain(record));
  }
}

