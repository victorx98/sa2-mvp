/**
 * Update Class Mentor Price Command (Application Layer)
 * [更新班级导师价格命令]
 *
 * Orchestrates class mentor price update use case
 * [编排班级导师价格更新用例]
 */

import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { ClassMentorPriceService } from "@domains/financial/services/class-mentor-price.service";
import { UpdateClassMentorPriceDto } from "@domains/financial/dto/update-class-mentor-price.dto";
import type { ClassMentorPrice } from "@infrastructure/database/schema";

@Injectable()
export class UpdateClassMentorPriceCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly classMentorPriceService: ClassMentorPriceService,
  ) {
    super(db);
  }

  /**
   * Execute update class mentor price use case
   * [执行更新班级导师价格用例]
   *
   * @param input - Update class mentor price input
   * @returns Updated class mentor price record
   */
  async execute(input: {
    id: string;
    dto: UpdateClassMentorPriceDto;
    updatedBy?: string;
  }): Promise<ClassMentorPrice> {
    try {
      this.logger.debug(
        `Updating class mentor price: ${input.id}`,
      );
      
      const classMentorPrice = await this.classMentorPriceService.updateClassMentorPrice(
        input.id,
        input.dto,
        input.updatedBy,
      );
      
      this.logger.debug(`Class mentor price updated successfully: ${classMentorPrice.id}`);
      return classMentorPrice;
    } catch (error) {
      this.logger.error(
        `Failed to update class mentor price: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
