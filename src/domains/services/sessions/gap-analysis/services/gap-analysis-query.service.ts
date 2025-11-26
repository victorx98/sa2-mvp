import { Injectable } from '@nestjs/common';
import { GapAnalysisRepository } from '../gap-analysis.repository';
import { GapAnalysisSessionEntity } from '../entities/gap-analysis-session.entity';
import { SessionFiltersDto } from '../../shared/dto/session-query.dto';
import { SessionNotFoundException } from '../../shared/exceptions/session-not-found.exception';

/**
 * Gap Analysis Query Service (CQRS - Query)
 * 
 * Handles read operations for gap analysis sessions
 */
@Injectable()
export class GapAnalysisQueryService {
  constructor(
    private readonly repository: GapAnalysisRepository,
  ) {}

  async getMentorSessions(
    mentorId: string,
    filters: SessionFiltersDto,
  ): Promise<GapAnalysisSessionEntity[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    return this.repository.findByMentorId(mentorId, excludeDeleted);
  }

  async getStudentSessions(
    studentId: string,
    filters: SessionFiltersDto,
  ): Promise<GapAnalysisSessionEntity[]> {
    const excludeDeleted = filters.excludeDeleted !== false;
    return this.repository.findByStudentId(studentId, excludeDeleted);
  }

  async getSessionById(id: string): Promise<GapAnalysisSessionEntity> {
    const session = await this.repository.findOne(id);
    if (!session) {
      throw new SessionNotFoundException(id);
    }
    return session;
  }
}

