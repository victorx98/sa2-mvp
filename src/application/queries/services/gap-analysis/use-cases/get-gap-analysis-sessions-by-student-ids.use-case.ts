import { Injectable, Inject } from '@nestjs/common';
import { IGapAnalysisQueryRepository, GAP_ANALYSIS_QUERY_REPOSITORY, GapAnalysisQueryDto } from '../interfaces/gap-analysis-query.repository.interface';
import { GapAnalysisReadModel } from '../interfaces/gap-analysis-query.repository.interface';

@Injectable()
export class GetGapAnalysisSessionsByStudentIdsUseCase {
  constructor(
    @Inject(GAP_ANALYSIS_QUERY_REPOSITORY)
    private readonly gapAnalysisQueryRepository: IGapAnalysisQueryRepository,
  ) {}

  async execute(studentIds: string[], filters?: GapAnalysisQueryDto): Promise<GapAnalysisReadModel[]> {
    return this.gapAnalysisQueryRepository.getSessionsByStudentIds(studentIds, filters);
  }
}
