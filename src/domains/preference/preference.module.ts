import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { JobCategoryRepository } from './repositories/job-category.repository';
import { JobCategoryService } from './services/job-category.service';

/**
 * Preference Domain Module
 * 偏好设置领域模块(Preference Domain Module)
 * 职责：管理参考数据，如岗位类别等
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    JobCategoryRepository,
    JobCategoryService,
  ],
  exports: [
    JobCategoryService,
  ],
})
export class PreferenceModule {}

