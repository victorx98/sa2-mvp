import { Module } from '@nestjs/common';
import { RegularMentoringModule } from './regular-mentoring/regular-mentoring.module';
import { GapAnalysisModule } from './gap-analysis/gap-analysis.module';
import { AiCareerModule } from './ai-career/ai-career.module';

/**
 * Sessions Module
 * 
 * Aggregates all session-related submodules
 */
@Module({
  imports: [
    RegularMentoringModule,
    GapAnalysisModule,
    AiCareerModule,
  ],
  exports: [
    RegularMentoringModule,
    GapAnalysisModule,
    AiCareerModule,
  ],
})
export class SessionsModule {}

