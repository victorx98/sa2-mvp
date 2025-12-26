/**
 * Preference Query Repositories Module
 * 参考数据查询仓储模块
 */
import { Module } from '@nestjs/common';
import { PreferenceModule } from '@domains/preference/preference.module';
import { JOB_CATEGORY_QUERY_REPOSITORY } from '../interfaces/job-category-query.repository.interface';
import { JOB_TITLE_QUERY_REPOSITORY } from '../interfaces/job-title-query.repository.interface';
import { PreferenceJobCategoryQueryRepository } from './repositories/preference-job-category-query.repository';
import { PreferenceJobTitleQueryRepository } from './repositories/preference-job-title-query.repository';

@Module({
  imports: [PreferenceModule],
  providers: [
    {
      provide: JOB_CATEGORY_QUERY_REPOSITORY,
      useClass: PreferenceJobCategoryQueryRepository,
    },
    {
      provide: JOB_TITLE_QUERY_REPOSITORY,
      useClass: PreferenceJobTitleQueryRepository,
    },
  ],
  exports: [JOB_CATEGORY_QUERY_REPOSITORY, JOB_TITLE_QUERY_REPOSITORY],
})
export class PreferenceQueryRepositoriesModule {}

