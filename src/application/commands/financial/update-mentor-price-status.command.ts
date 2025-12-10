import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorPriceService } from "@domains/financial/services/mentor-price.service";

/**
 * Update Mentor Price Status Command (Application Layer)
 * [更新导师价格状态命令]
 *
 * Orchestrates mentor price status update use case
 * [编排导师价格状态更新用例]
 */
@Injectable()
export class UpdateMentorPriceStatusCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly mentorPriceService: MentorPriceService,
  ) {
    super(db);
  }

  /**
   * Execute update mentor price status use case
   * [执行更新导师价格状态用例]
   *
   * @param input - Update mentor price status input
   */
  async execute(input: {
    id: string;
    status: "active" | "inactive";
    updatedBy?: string;
  }): Promise<void> {
    try {
      this.logger.debug(
        `Updating mentor price status: ${input.id} -> ${input.status}`,
      );
      await this.mentorPriceService.updateMentorPriceStatus(
        input.id,
        input.status,
        input.updatedBy,
      );
      this.logger.debug(
        `Mentor price status updated successfully: ${input.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update mentor price status: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

