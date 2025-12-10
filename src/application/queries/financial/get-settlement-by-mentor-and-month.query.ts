import { Injectable } from "@nestjs/common";
import { QueryBase } from "@application/core/query.base";
import { SettlementService } from "@domains/financial/services/settlement.service";
import type { ISettlementDetailResponse } from "@domains/financial/dto/settlement";

/**
 * Get Settlement By Mentor And Month Query (Application Layer)
 * [根据导师和月份获取结算查询]
 *
 * Retrieves a settlement record for a specific mentor and month
 * [检索特定导师和月份的结算记录]
 */
@Injectable()
export class GetSettlementByMentorAndMonthQuery extends QueryBase {
  constructor(private readonly settlementService: SettlementService) {
    super();
  }

  /**
   * Execute query
   * [执行查询]
   *
   * @param input - Query input with mentorId and settlementMonth
   * @returns Settlement detail response or null
   */
  async execute(input: {
    mentorId: string;
    settlementMonth: string;
  }): Promise<ISettlementDetailResponse | null> {
    return this.withErrorHandling(async () => {
      return this.settlementService.getSettlementByMentorAndMonth(
        input.mentorId,
        input.settlementMonth,
      );
    });
  }
}

