import { Injectable, Logger } from '@nestjs/common';
import { JobTitleService } from '@domains/preference/services/job-title.service';
import type {
  JobTitleEntity,
  JobTitleQueryOptions,
} from '@domains/preference/entities/job-title.entity';

/**
 * List Job Titles Query Result
 * 岗位名称列表查询结果(List Job Titles Query Result)
 */
export interface ListJobTitlesResult {
  data: JobTitleEntity[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * List Job Titles Query
 * 岗位名称列表查询(List Job Titles Query)
 * 职责：处理岗位名称分页查询的业务用例
 */
@Injectable()
export class ListJobTitlesQuery {
  private readonly logger = new Logger(ListJobTitlesQuery.name);

  constructor(
    private readonly jobTitleService: JobTitleService,
  ) {}

  /**
   * 执行分页查询(Execute paginated query)
   */
  async execute(options: JobTitleQueryOptions): Promise<ListJobTitlesResult> {
    this.logger.log(`Querying job titles with options: ${JSON.stringify(options)}`);

    const result = await this.jobTitleService.findAll(options);

    this.logger.log(`Found ${result.total} job titles`);

    return result;
  }

  /**
   * 根据ID查询单个岗位名称(Find job title by ID)
   */
  async findById(id: string): Promise<JobTitleEntity> {
    this.logger.log(`Finding job title by id: ${id}`);

    return await this.jobTitleService.findById(id);
  }
}

