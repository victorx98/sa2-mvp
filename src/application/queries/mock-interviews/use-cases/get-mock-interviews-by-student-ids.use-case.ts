import { Injectable, Inject } from '@nestjs/common';
import {
  IMockInterviewQueryRepository,
  MOCK_INTERVIEW_QUERY_REPOSITORY,
  MockInterviewFilters,
  MockInterviewReadModel,
} from '../interfaces/mock-interview-query.repository.interface';
import { IPaginatedResult } from '@shared/types/paginated-result';

@Injectable()
export class GetMockInterviewsByStudentIdsUseCase {
  constructor(
    @Inject(MOCK_INTERVIEW_QUERY_REPOSITORY)
    private readonly mockInterviewQueryRepository: IMockInterviewQueryRepository,
  ) {}

  async execute(
    studentIds: string[],
    filters?: MockInterviewFilters,
    page: number = 1,
    pageSize: number = 50,
  ): Promise<IPaginatedResult<MockInterviewReadModel>> {
    return this.mockInterviewQueryRepository.getInterviewsByStudentIds(studentIds, page, pageSize, filters);
  }
}
