import { Injectable } from "@nestjs/common";
import { QueryBase } from "@application/core/query.base";
import { SettlementService } from "@domains/financial/services/settlement.service";
import type { ISettlementDetailItem } from "@domains/financial/dto/settlement";

/**
 * Get Settlement Details Query (Application Layer)
 * [获取结算明细查询]
 *
 * Retrieves all settlement detail records for a specific settlement
 * [检索特定结算的所有结算明细记录]
 */
@Injectable()
export class GetSettlementDetailsQuery extends QueryBase {
  constructor(private readonly settlementService: SettlementService) {
    super();
  }

  /**
   * Execute query
   * [执行查询]
   *
   * @param input - Query input with settlementId
   * @returns Array of settlement detail items
   */
  async execute(input: {
    settlementId: string;
  }): Promise<ISettlementDetailItem[]> {
    return this.withErrorHandling(async () => {
      return this.settlementService.getSettlementDetails(input.settlementId);
    });
  }
}

