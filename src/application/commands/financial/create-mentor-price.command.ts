import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorPriceService } from "@domains/financial/services/mentor-price.service";
import { CreateMentorPriceDto } from "@domains/financial/dto/create-mentor-price.dto";
import type { MentorPrice } from "@infrastructure/database/schema";

/**
 * Create Mentor Price Command (Application Layer)
 * [创建导师价格命令]
 *
 * Orchestrates mentor price creation use case
 * [编排导师价格创建用例]
 */
@Injectable()
export class CreateMentorPriceCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly mentorPriceService: MentorPriceService,
  ) {
    super(db);
  }

  /**
   * Execute create mentor price use case
   * [执行创建导师价格用例]
   *
   * @param input - Create mentor price input
   * @returns Created mentor price record
   */
  async execute(input: {
    dto: CreateMentorPriceDto;
    updatedBy?: string;
  }): Promise<MentorPrice> {
    try {
      this.logger.debug(
        `Creating mentor price for mentor: ${input.dto.mentorUserId}, session type: ${input.dto.sessionTypeCode}`,
      );
      const mentorPrice = await this.mentorPriceService.createMentorPrice(
        input.dto,
        input.updatedBy,
      );
      this.logger.debug(`Mentor price created successfully: ${mentorPrice.id}`);
      return mentorPrice;
    } catch (error) {
      this.logger.error(
        `Failed to create mentor price: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

