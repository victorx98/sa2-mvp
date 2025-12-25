/**
 * Placement Query Repositories Module
 * 岗位查询仓储模块
 * 
 * Provides DI bindings for Placement query repositories
 * Imports DatabaseModule to access DB connection
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { JOB_QUERY_REPOSITORY } from '../interfaces/job-query.repository.interface';
import { JOB_APPLICATION_QUERY_REPOSITORY } from '../interfaces/job-application-query.repository.interface';
import { DrizzleJobQueryRepository } from './repositories/drizzle-job-query.repository';
import { DrizzleJobApplicationQueryRepository } from './repositories/drizzle-job-application-query.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: JOB_QUERY_REPOSITORY,
      useClass: DrizzleJobQueryRepository,
    },
    {
      provide: JOB_APPLICATION_QUERY_REPOSITORY,
      useClass: DrizzleJobApplicationQueryRepository,
    },
  ],
  exports: [JOB_QUERY_REPOSITORY, JOB_APPLICATION_QUERY_REPOSITORY],
})
export class PlacementQueryRepositoriesModule {}

