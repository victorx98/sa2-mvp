import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { SettlementService } from '@domains/financial/services/settlement.service';

/**
 * Get Settlement Query
 * [获取结算详情查询]
 * 
 * 用于获取单个结算的详细信息
 */
@Injectable()
export class GetSettlementQuery extends QueryBase {
  constructor(
    private readonly settlementService: SettlementService
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
      return this.settlementService.getSettlementById(input.id);
    });
  }
}
