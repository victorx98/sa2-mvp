import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorPaymentInfoService } from "@domains/financial/services/mentor-payment-info.service";
import type { IMentorPaymentInfoResponse } from "@domains/financial/dto/settlement";

/**
 * Update Mentor Payment Info Status Command (Application Layer)
 * [更新导师支付信息状态命令]
 *
 * Orchestrates mentor payment info status update use case
 * [编排导师支付信息状态更新用例]
 */
@Injectable()
export class UpdateMentorPaymentInfoStatusCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly mentorPaymentInfoService: MentorPaymentInfoService,
  ) {
    super(db);
  }

  /**
   * Execute update mentor payment info status use case
   * [执行更新导师支付信息状态用例]
   *
   * @param input - Update mentor payment info status input
   * @returns Updated mentor payment info response
   */
  async execute(input: {
    id: string;
    status: "ACTIVE" | "INACTIVE";
    updatedBy: string;
  }): Promise<IMentorPaymentInfoResponse> {
    try {
      this.logger.debug(
        `Updating payment info status: ${input.id} -> ${input.status}`,
      );
      const paymentInfo = await this.mentorPaymentInfoService.updateStatus(
        input.id,
        input.status,
        input.updatedBy,
      );
      this.logger.debug(
        `Payment info status updated successfully: ${input.id}`,
      );
      return paymentInfo;
    } catch (error) {
      this.logger.error(
        `Failed to update mentor payment info status: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

