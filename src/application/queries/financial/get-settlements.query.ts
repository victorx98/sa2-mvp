import { Injectable } from '@nestjs/common';
import { QueryBase } from '@application/core/query.base';
import { SettlementService } from '@domains/financial/services/settlement.service';
import { ISettlementQuery } from '@domains/financial/dto/settlement';

/**
 * Get Settlements Query
 * [获取结算列表查询]
 * 
 * 用于获取结算列表
 */
@Injectable()
export class GetSettlementsQuery extends QueryBase {
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
    query: ISettlementQuery;
  }) {
    return this.withErrorHandling(async () => {
      return this.settlementService.findSettlements(input.query);
    });
  }
}
