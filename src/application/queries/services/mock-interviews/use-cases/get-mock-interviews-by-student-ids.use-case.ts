import { Injectable, Inject } from '@nestjs/common';
import { IMockInterviewQueryRepository, MOCK_INTERVIEW_QUERY_REPOSITORY, MockInterviewQueryDto } from '../interfaces/mock-interview-query.repository.interface';
import { MockInterviewReadModel } from '../interfaces/mock-interview-query.repository.interface';

@Injectable()
export class GetMockInterviewsByStudentIdsUseCase {
  constructor(
    @Inject(MOCK_INTERVIEW_QUERY_REPOSITORY)
    private readonly mockInterviewQueryRepository: IMockInterviewQueryRepository,
  ) {}

  async execute(studentIds: string[], filters?: MockInterviewQueryDto): Promise<MockInterviewReadModel[]> {
    return this.mockInterviewQueryRepository.getInterviewsByStudentIds(studentIds, filters);
  }
}
