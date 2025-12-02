import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { MentorAppealService } from '@domains/financial/services/mentor-appeal.service';
import { AppealSearchDto } from '@domains/financial/dto/appeals/appeal-search.dto';
import { IPaginationQuery, ISortQuery } from '@shared/types/pagination.types';
import { IPaginatedResult } from '@shared/types/paginated-result';
import { IMentorAppeal } from '@domains/financial/interfaces/mentor-appeal.interface';

/**
 * Get Mentor Appeals Query
 * [获取导师申诉列表查询]
 * 
 * 用于获取导师申诉列表
 */
@Injectable()
export class GetMentorAppealsQuery extends QueryBase {
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
    filter: AppealSearchDto;
    pagination?: IPaginationQuery;
    sort?: ISortQuery;
  }): Promise<IPaginatedResult<IMentorAppeal>> {
    return this.withErrorHandling(async () => {
      return this.mentorAppealService.search(
        input.filter,
        input.pagination || { page: 1, pageSize: 10 },
        input.sort
      );
    });
  }
}
