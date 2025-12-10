import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorPriceService } from "@domains/financial/services/mentor-price.service";
import { UpdateMentorPriceDto } from "@domains/financial/dto/update-mentor-price.dto";
import type { MentorPrice } from "@infrastructure/database/schema";

/**
 * Batch Update Mentor Prices Command (Application Layer)
 * [批量更新导师价格命令]
 *
 * Orchestrates batch mentor price update use case
 * [编排批量导师价格更新用例]
 */
@Injectable()
export class BatchUpdateMentorPricesCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly mentorPriceService: MentorPriceService,
  ) {
    super(db);
  }

  /**
   * Execute batch update mentor prices use case
   * [执行批量更新导师价格用例]
   *
   * @param input - Batch update mentor prices input
   * @returns Array of updated mentor price records
   */
  async execute(input: {
    updates: Array<{ id: string; dto: UpdateMentorPriceDto }>;
    updatedBy?: string;
  }): Promise<MentorPrice[]> {
    try {
      this.logger.debug(
        `Batch updating ${input.updates.length} mentor prices`,
      );
      const mentorPrices =
        await this.mentorPriceService.batchUpdateMentorPrices(
          input.updates,
          input.updatedBy,
        );
      this.logger.debug(
        `Batch updated ${mentorPrices.length} mentor prices successfully`,
      );
      return mentorPrices;
    } catch (error) {
      this.logger.error(
        `Failed to batch update mentor prices: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

