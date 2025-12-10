import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorPriceService } from "@domains/financial/services/mentor-price.service";
import { UpdateMentorPriceDto } from "@domains/financial/dto/update-mentor-price.dto";
import type { MentorPrice } from "@infrastructure/database/schema";

/**
 * Update Mentor Price Command (Application Layer)
 * [更新导师价格命令]
 *
 * Orchestrates mentor price update use case
 * [编排导师价格更新用例]
 */
@Injectable()
export class UpdateMentorPriceCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly mentorPriceService: MentorPriceService,
  ) {
    super(db);
  }

  /**
   * Execute update mentor price use case
   * [执行更新导师价格用例]
   *
   * @param input - Update mentor price input
   * @returns Updated mentor price record
   */
  async execute(input: {
    id: string;
    dto: UpdateMentorPriceDto;
    updatedBy?: string;
  }): Promise<MentorPrice> {
    try {
      this.logger.debug(`Updating mentor price: ${input.id}`);
      const mentorPrice = await this.mentorPriceService.updateMentorPrice(
        input.id,
        input.dto,
        input.updatedBy,
      );
      this.logger.debug(`Mentor price updated successfully: ${mentorPrice.id}`);
      return mentorPrice;
    } catch (error) {
      this.logger.error(
        `Failed to update mentor price: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

