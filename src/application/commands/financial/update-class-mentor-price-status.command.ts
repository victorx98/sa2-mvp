/**
 * Update Class Mentor Price Status Command (Application Layer)
 * [更新班级导师价格状态命令]
 *
 * Orchestrates class mentor price status update use case
 * [编排班级导师价格状态更新用例]
 */

import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { ClassMentorPriceStatus } from "@shared/types/financial-enums";
import { CommandBase } from "@application/core/command.base";
import { ClassMentorPriceService } from "@domains/financial/services/class-mentor-price.service";
import type { ClassMentorPrice } from "@infrastructure/database/schema";

@Injectable()
export class UpdateClassMentorPriceStatusCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly classMentorPriceService: ClassMentorPriceService,
  ) {
    super(db);
  }

  /**
   * Execute update class mentor price status use case
   * [执行更新班级导师价格状态用例]
   *
   * @param input - Update class mentor price status input
   * @returns Updated class mentor price record
   */
  async execute(input: {
    id: string;
    status: ClassMentorPriceStatus;
    updatedBy?: string;
  }): Promise<ClassMentorPrice> {
    try {
      this.logger.debug(
        `Updating class mentor price status: ${input.id}, new status: ${input.status}`,
      );
      
      const classMentorPrice = await this.classMentorPriceService.updateStatus(
        input.id,
        input.status,
        input.updatedBy,
      );
      
      this.logger.debug(`Class mentor price status updated successfully: ${classMentorPrice.id}`);
      return classMentorPrice;
    } catch (error) {
      this.logger.error(
        `Failed to update class mentor price status: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
