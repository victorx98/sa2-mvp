import { Module } from '@nestjs/common';
import { MockInterviewDomainService } from './services/mock-interview-domain.service';
import { MockInterviewRepository } from './infrastructure/repositories/mock-interview.repository';
import { MOCK_INTERVIEW_REPOSITORY } from './repositories/mock-interview.repository.interface';

/**
 * Mock Interviews Domain Module
 * Encapsulates domain logic for AI-powered mock interviews
 */
@Module({
  providers: [
    MockInterviewDomainService,
    {
      provide: MOCK_INTERVIEW_REPOSITORY,
      useClass: MockInterviewRepository,
    },
  ],
  exports: [
    MockInterviewDomainService,
    MOCK_INTERVIEW_REPOSITORY,
  ],
})
export class MockInterviewsModule {}

