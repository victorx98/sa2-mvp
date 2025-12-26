import { Injectable, Inject } from '@nestjs/common';
import { IGapAnalysisQueryRepository, GAP_ANALYSIS_QUERY_REPOSITORY } from '../interfaces/gap-analysis-query.repository.interface';
import { GapAnalysisReadModel } from '../interfaces/gap-analysis-query.repository.interface';

@Injectable()
export class GetGapAnalysisByIdUseCase {
  constructor(
    @Inject(GAP_ANALYSIS_QUERY_REPOSITORY)
    private readonly gapAnalysisQueryRepository: IGapAnalysisQueryRepository,
  ) {}

  async execute(sessionId: string): Promise<GapAnalysisReadModel> {
    return this.gapAnalysisQueryRepository.getSessionById(sessionId);
  }
}
