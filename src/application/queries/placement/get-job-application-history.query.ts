import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { JobApplicationService } from '@domains/placement/services/job-application.service';

/**
 * Get Job Application History Query
 * [获取职位申请历史查询]
 * 
 * 用于获取职位申请的状态历史记录
 */
@Injectable()
export class GetJobApplicationHistoryQuery extends QueryBase {
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
    applicationId: string;
  }) {
    return this.withErrorHandling(async () => {
      return this.jobApplicationService.getStatusHistory(input.applicationId);
    });
  }
}

