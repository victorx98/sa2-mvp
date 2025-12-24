import { Injectable, Logger } from '@nestjs/common';
import { JobCategoryService } from '@domains/preference/services/job-category.service';
import type {
  JobCategoryEntity,
  JobCategoryQueryOptions,
} from '@domains/preference/entities/job-category.entity';

/**
 * List Job Categories Query Result
 * 岗位类别列表查询结果(List Job Categories Query Result)
 */
export interface ListJobCategoriesResult {
  data: JobCategoryEntity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * List Job Categories Query
 * 岗位类别列表查询(List Job Categories Query)
 * 职责：处理岗位类别分页查询的业务用例
 */
@Injectable()
export class ListJobCategoriesQuery {
  private readonly logger = new Logger(ListJobCategoriesQuery.name);

  constructor(
    private readonly jobCategoryService: JobCategoryService,
  ) {}

  /**
   * 执行分页查询(Execute paginated query)
   */
  async execute(options: JobCategoryQueryOptions): Promise<ListJobCategoriesResult> {
    this.logger.log(`Querying job categories with options: ${JSON.stringify(options)}`);

    const result = await this.jobCategoryService.findAll(options);

    this.logger.log(`Found ${result.total} job categories`);

    return result;
  }

  /**
   * 根据ID查询单个岗位类别(Find job category by ID)
   */
  async findById(id: string): Promise<JobCategoryEntity> {
    this.logger.log(`Finding job category by id: ${id}`);

    return await this.jobCategoryService.findById(id);
  }
}

