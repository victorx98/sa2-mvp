import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { MentorAppealService } from '@domains/financial/services/mentor-appeal.service';
import { IMentorAppeal } from '@domains/financial/interfaces/mentor-appeal.interface';

/**
 * Get Mentor Appeal Query
 * [获取导师申诉详情查询]
 * 
 * 用于获取单个导师申诉的详细信息
 */
@Injectable()
export class GetMentorAppealQuery extends QueryBase {
  constructor(
    private readonly mentorAppealService: MentorAppealService
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
  }): Promise<IMentorAppeal | null> {
    return this.withErrorHandling(async () => {
      return this.mentorAppealService.findOne({ id: input.id });
    });
  }
}
