import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DrizzleAiCareerQueryRepository } from './repositories/drizzle-ai-career-query.repository';
import { AI_CAREER_QUERY_REPOSITORY } from '../interfaces/ai-career-query.repository.interface';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: AI_CAREER_QUERY_REPOSITORY,
      useClass: DrizzleAiCareerQueryRepository,
    },
  ],
  exports: [AI_CAREER_QUERY_REPOSITORY],
})
export class AiCareerQueryRepositoriesModule {}
