/**
 * Class Query Repositories Module
 * 班级查询仓储模块
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DrizzleClassQueryRepository } from '../infrastructure/repositories/drizzle-class-query.repository';
import { CLASS_QUERY_REPOSITORY } from '../interfaces/class-query.repository.interface';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: CLASS_QUERY_REPOSITORY,
      useClass: DrizzleClassQueryRepository,
    },
  ],
  exports: [CLASS_QUERY_REPOSITORY],
})
export class ClassQueryRepositoriesModule {}
