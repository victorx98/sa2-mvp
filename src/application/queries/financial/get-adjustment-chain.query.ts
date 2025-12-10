import { Injectable } from "@nestjs/common";
import { QueryBase } from "@application/core/query.base";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import * as schema from "@infrastructure/database/schema";

/**
 * Get Adjustment Chain Query (Application Layer)
 * [获取调整记录链查询]
 *
 * Retrieves all adjustment records for a specific payable ledger
 * [检索特定应付账款的所有调整记录]
 */
@Injectable()
export class GetAdjustmentChainQuery extends QueryBase {
  constructor(private readonly mentorPayableService: MentorPayableService) {
    super();
  }

  /**
   * Execute query
   * [执行查询]
   *
   * @param input - Query input with originalLedgerId
   * @returns Array of adjustment ledger records
   */
  async execute(input: {
    originalLedgerId: string;
  }): Promise<(typeof schema.mentorPayableLedgers.$inferSelect)[]> {
    return this.withErrorHandling(async () => {
      return this.mentorPayableService.getAdjustmentChain(
        input.originalLedgerId,
      );
    });
  }
}

