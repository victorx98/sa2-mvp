import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { JobCategoryRepository } from './repositories/job-category.repository';
import { JobCategoryService } from './services/job-category.service';
import { JobTitleRepository } from './repositories/job-title.repository';
import { JobTitleService } from './services/job-title.service';

/**
 * Preference Domain Module
 * 偏好设置领域模块(Preference Domain Module)
 * 职责：管理参考数据，如岗位类别、岗位名称等
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    JobCategoryRepository,
    JobCategoryService,
    JobTitleRepository,
    JobTitleService,
  ],
  exports: [
    JobCategoryService,
    JobTitleService,
  ],
})
export class PreferenceModule {}

