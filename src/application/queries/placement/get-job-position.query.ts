import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { JobApplicationService } from '@domains/placement/services/job-application.service';

/**
 * Get Job Application Query
 * [获取职位申请详情查询]
 * 
 * 用于获取单个职位申请的详细信息
 */
@Injectable()
export class GetJobPositionQuery extends QueryBase {
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
    id: string;
  }) {
    return this.withErrorHandling(async () => {
      return this.jobApplicationService.findOne({ id: input.id });
    });
  }
}
