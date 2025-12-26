import { Injectable, Inject } from '@nestjs/common';
import { IAiCareerQueryRepository, AI_CAREER_QUERY_REPOSITORY } from '../interfaces/ai-career-query.repository.interface';
import { AiCareerReadModel } from '../interfaces/ai-career-query.repository.interface';

@Injectable()
export class GetAiCareerByIdUseCase {
  constructor(
    @Inject(AI_CAREER_QUERY_REPOSITORY)
    private readonly aiCareerQueryRepository: IAiCareerQueryRepository,
  ) {}

  async execute(sessionId: string): Promise<AiCareerReadModel> {
    return this.aiCareerQueryRepository.getSessionById(sessionId);
  }
}
