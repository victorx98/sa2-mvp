/**
 * Financial Query Repositories Module
 * 财务查询仓储模块
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { MENTOR_PRICE_QUERY_REPOSITORY } from '../interfaces/mentor-price-query.repository.interface';
import { MENTOR_APPEAL_QUERY_REPOSITORY } from '../interfaces/mentor-appeal-query.repository.interface';
import { DrizzleMentorPriceQueryRepository } from './repositories/drizzle-mentor-price-query.repository';
import { DrizzleMentorAppealQueryRepository } from './repositories/drizzle-mentor-appeal-query.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: MENTOR_PRICE_QUERY_REPOSITORY,
      useClass: DrizzleMentorPriceQueryRepository,
    },
    {
      provide: MENTOR_APPEAL_QUERY_REPOSITORY,
      useClass: DrizzleMentorAppealQueryRepository,
    },
  ],
  exports: [MENTOR_PRICE_QUERY_REPOSITORY, MENTOR_APPEAL_QUERY_REPOSITORY],
})
export class FinancialQueryRepositoriesModule {}

