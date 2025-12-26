import { Injectable, Inject } from '@nestjs/common';
import { IMockInterviewQueryRepository, MOCK_INTERVIEW_QUERY_REPOSITORY, MockInterviewQueryDto } from '../interfaces/mock-interview-query.repository.interface';
import { MockInterviewReadModel } from '../interfaces/mock-interview-query.repository.interface';

@Injectable()
export class GetStudentMockInterviewsUseCase {
  constructor(
    @Inject(MOCK_INTERVIEW_QUERY_REPOSITORY)
    private readonly mockInterviewQueryRepository: IMockInterviewQueryRepository,
  ) {}

  async execute(studentId: string, filters?: MockInterviewQueryDto, limit?: number, offset?: number): Promise<MockInterviewReadModel[]> {
    const queryDto: MockInterviewQueryDto = {
      ...filters,
      limit: limit,
      offset: offset,
    };
    return this.mockInterviewQueryRepository.getStudentInterviews(studentId, queryDto);
  }
}
