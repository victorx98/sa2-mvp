import { Injectable, Inject } from '@nestjs/common';
import { IGapAnalysisQueryRepository, GAP_ANALYSIS_QUERY_REPOSITORY, GapAnalysisQueryDto } from '../interfaces/gap-analysis-query.repository.interface';
import { GapAnalysisReadModel } from '../interfaces/gap-analysis-query.repository.interface';

@Injectable()
export class GetMentorGapAnalysisSessionsUseCase {
  constructor(
    @Inject(GAP_ANALYSIS_QUERY_REPOSITORY)
    private readonly gapAnalysisQueryRepository: IGapAnalysisQueryRepository,
  ) {}

  async execute(mentorId: string, filters?: GapAnalysisQueryDto): Promise<GapAnalysisReadModel[]> {
    return this.gapAnalysisQueryRepository.getMentorSessions(mentorId, filters);
  }
}
