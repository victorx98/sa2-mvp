import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import {
  IMockInterviewQueryRepository,
  MOCK_INTERVIEW_QUERY_REPOSITORY,
} from '../interfaces/mock-interview-query.repository.interface';
import { DrizzleMockInterviewQueryRepository } from './repositories/drizzle-mock-interview-query.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: MOCK_INTERVIEW_QUERY_REPOSITORY,
      useClass: DrizzleMockInterviewQueryRepository,
    },
  ],
  exports: [MOCK_INTERVIEW_QUERY_REPOSITORY],
})
export class MockInterviewsQueryRepositoriesModule {}
