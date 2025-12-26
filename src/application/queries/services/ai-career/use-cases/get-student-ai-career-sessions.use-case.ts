import { Injectable, Inject } from '@nestjs/common';
import { IAiCareerQueryRepository, AI_CAREER_QUERY_REPOSITORY, AiCareerQueryDto } from '../interfaces/ai-career-query.repository.interface';
import { AiCareerReadModel } from '../interfaces/ai-career-query.repository.interface';

@Injectable()
export class GetStudentAiCareerSessionsUseCase {
  constructor(
    @Inject(AI_CAREER_QUERY_REPOSITORY)
    private readonly aiCareerQueryRepository: IAiCareerQueryRepository,
  ) {}

  async execute(studentId: string, filters?: AiCareerQueryDto): Promise<AiCareerReadModel[]> {
    return this.aiCareerQueryRepository.getStudentSessions(studentId, filters);
  }
}
