/**
 * Create Class Mentor Price Command (Application Layer)
 * [创建班级导师价格命令]
 *
 * Orchestrates class mentor price creation use case
 * [编排班级导师价格创建用例]
 */

import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { ClassMentorPriceService } from "@domains/financial/services/class-mentor-price.service";
import { CreateClassMentorPriceDto } from "@domains/financial/dto/create-class-mentor-price.dto";
import type { ClassMentorPrice } from "@infrastructure/database/schema";

@Injectable()
export class CreateClassMentorPriceCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly classMentorPriceService: ClassMentorPriceService,
  ) {
    super(db);
  }

  /**
   * Execute create class mentor price use case
   * [执行创建班级导师价格用例]
   *
   * @param input - Create class mentor price input
   * @returns Created class mentor price record
   */
  async execute(input: {
    dto: CreateClassMentorPriceDto;
    updatedBy?: string;
  }): Promise<ClassMentorPrice> {
    try {
      this.logger.debug(
        `Creating class mentor price for class: ${input.dto.classId}, mentor: ${input.dto.mentorUserId}`,
      );
      
      const classMentorPrice = await this.classMentorPriceService.createClassMentorPrice(
        input.dto,
        input.updatedBy,
      );
      
      this.logger.debug(`Class mentor price created successfully: ${classMentorPrice.id}`);
      return classMentorPrice;
    } catch (error) {
      this.logger.error(
        `Failed to create class mentor price: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
