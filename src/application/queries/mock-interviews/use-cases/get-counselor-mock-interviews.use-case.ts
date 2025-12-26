import { Injectable, Inject } from '@nestjs/common';
import {
  IMockInterviewQueryRepository,
  MOCK_INTERVIEW_QUERY_REPOSITORY,
  MockInterviewFilters,
  MockInterviewReadModel,
} from '../interfaces/mock-interview-query.repository.interface';
import { IPaginatedResult } from '@shared/types/paginated-result';

@Injectable()
export class GetCounselorMockInterviewsUseCase {
  constructor(
    @Inject(MOCK_INTERVIEW_QUERY_REPOSITORY)
    private readonly mockInterviewQueryRepository: IMockInterviewQueryRepository,
  ) {}

  async execute(
    counselorId: string,
    filters?: MockInterviewFilters,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<IPaginatedResult<MockInterviewReadModel>> {
    return this.mockInterviewQueryRepository.getCounselorInterviews(counselorId, page, pageSize, filters);
  }
}
