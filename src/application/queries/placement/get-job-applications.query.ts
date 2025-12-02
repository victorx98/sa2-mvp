import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { JobApplicationService } from '@domains/placement/services/job-application.service';
import { IPaginationQuery, ISortQuery } from '@shared/types/pagination.types';
import { IJobApplicationSearchFilter } from '@domains/placement/dto';

/**
 * Get Job Applications Query
 * [获取职位申请列表查询]
 * 
 * 用于获取职位申请列表
 */
@Injectable()
export class GetJobApplicationsQuery extends QueryBase {
  constructor(
    private readonly jobApplicationService: JobApplicationService
  ) {
    super();
  }

  /**
   * 执行查询
   * [Execute query]
   * 
   * @param input 查询输入
   * @returns 查询结果
   */
  async execute(input: {
    filter?: IJobApplicationSearchFilter;
    pagination?: IPaginationQuery;
    sort?: ISortQuery;
  }) {
    return this.withErrorHandling(async () => {
      return this.jobApplicationService.search(input.filter, input.pagination, input.sort);
    });
  }
}
