import { Injectable, Inject } from '@nestjs/common';
import {
  IMockInterviewQueryRepository,
  MOCK_INTERVIEW_QUERY_REPOSITORY,
  MockInterviewReadModel,
} from '../interfaces/mock-interview-query.repository.interface';

@Injectable()
export class GetMockInterviewByIdUseCase {
  constructor(
    @Inject(MOCK_INTERVIEW_QUERY_REPOSITORY)
    private readonly mockInterviewQueryRepository: IMockInterviewQueryRepository,
  ) {}

  async execute(interviewId: string): Promise<MockInterviewReadModel> {
    return this.mockInterviewQueryRepository.getInterviewById(interviewId);
  }
}
