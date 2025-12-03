import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { QueryBase } from '@application/core/query.base';
import { ContractService } from '@domains/contract/services/contract.service';
import type { Contract } from '@infrastructure/database/schema';
import { IPaginationQuery, ISortQuery } from '@shared/types/pagination.types';

/**
 * Get Contracts Query (Application Layer)
 * [获取合同列表查询]
 * 
 * 职责：
 * 1. 编排获取合同列表用例
 * 2. 调用 Contract Domain 的 Contract Service
 * 3. 返回合同列表
 */
@Injectable()
export class GetContractsQuery extends QueryBase {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly db: DrizzleDatabase,
    private readonly contractService: ContractService,
  ) {
    super();
  }

  /**
   * 执行获取合同列表用例
   * [Execute get contracts use case]
   * 
   * @param filter 过滤条件
   * @param pagination 分页参数
   * @param sort 排序参数
   * @returns 合同列表
   */
  async execute(
    filter: { 
      studentId?: string; 
      status?: string; 
      productId?: string; 
      signedAfter?: Date; 
      signedBefore?: Date; 
    },
    pagination?: IPaginationQuery,
    sort?: ISortQuery
  ): Promise<{
    data: Contract[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      this.logger.debug(`Getting contracts with filter: ${JSON.stringify(filter)}`);
      const contracts = await this.contractService.search(
        filter, 
        pagination ? { page: pagination.page, pageSize: pagination.pageSize } : undefined, 
      sort ? { field: sort.field, order: sort.direction } : undefined
      );
      this.logger.debug(`Retrieved ${contracts.data.length} contracts`);
      return contracts;
    } catch (error) {
      this.logger.error(`Failed to get contracts: ${error.message}`, error.stack);
      throw error;
    }
  }
}