import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorPayableService } from "@domains/financial/services/mentor-payable.service";
import { AdjustPayableLedgerDto } from "@domains/financial/dto/adjust-payable-ledger.dto";

/**
 * Adjust Payable Ledger Command (Application Layer)
 * [调整应付账款命令]
 *
 * Orchestrates payable ledger adjustment use case
 * [编排应付账款调整用例]
 */
@Injectable()
export class AdjustPayableLedgerCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly mentorPayableService: MentorPayableService,
  ) {
    super(db);
  }

  /**
   * Execute adjust payable ledger use case
   * [执行调整应付账款用例]
   *
   * @param input - Adjust payable ledger input
   */
  async execute(input: AdjustPayableLedgerDto): Promise<void> {
    try {
      this.logger.debug(
        `Adjusting payable ledger: ${input.ledgerId}, amount: ${input.adjustmentAmount}`,
      );
      await this.mentorPayableService.adjustPayableLedger({
        originalLedgerId: input.ledgerId,
        adjustmentAmount: input.adjustmentAmount,
        reason: input.reason,
        createdBy: input.createdBy,
      });
      this.logger.debug(
        `Payable ledger adjusted successfully: ${input.ledgerId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to adjust payable ledger: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

