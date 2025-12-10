import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorPriceService } from "@domains/financial/services/mentor-price.service";
import { CreateMentorPriceDto } from "@domains/financial/dto/create-mentor-price.dto";
import type { MentorPrice } from "@infrastructure/database/schema";

/**
 * Batch Create Mentor Prices Command (Application Layer)
 * [批量创建导师价格命令]
 *
 * Orchestrates batch mentor price creation use case
 * [编排批量导师价格创建用例]
 */
@Injectable()
export class BatchCreateMentorPricesCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly mentorPriceService: MentorPriceService,
  ) {
    super(db);
  }

  /**
   * Execute batch create mentor prices use case
   * [执行批量创建导师价格用例]
   *
   * @param input - Batch create mentor prices input
   * @returns Array of created mentor price records
   */
  async execute(input: {
    dtos: CreateMentorPriceDto[];
    createdBy?: string;
  }): Promise<MentorPrice[]> {
    try {
      this.logger.debug(
        `Batch creating ${input.dtos.length} mentor prices`,
      );
      const mentorPrices =
        await this.mentorPriceService.batchCreateMentorPrices(
          input.dtos,
          input.createdBy,
        );
      this.logger.debug(
        `Batch created ${mentorPrices.length} mentor prices successfully`,
      );
      return mentorPrices;
    } catch (error) {
      this.logger.error(
        `Failed to batch create mentor prices: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

