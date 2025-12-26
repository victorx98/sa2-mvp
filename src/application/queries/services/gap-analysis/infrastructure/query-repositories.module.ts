import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DrizzleGapAnalysisQueryRepository } from './repositories/drizzle-gap-analysis-query.repository';
import { GAP_ANALYSIS_QUERY_REPOSITORY } from '../interfaces/gap-analysis-query.repository.interface';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: GAP_ANALYSIS_QUERY_REPOSITORY,
      useClass: DrizzleGapAnalysisQueryRepository,
    },
  ],
  exports: [GAP_ANALYSIS_QUERY_REPOSITORY],
})
export class GapAnalysisQueryRepositoriesModule {}
