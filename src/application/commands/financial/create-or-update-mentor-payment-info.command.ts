import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorPaymentInfoService } from "@domains/financial/services/mentor-payment-info.service";
import type { ICreateOrUpdateMentorPaymentInfoRequest } from "@domains/financial/dto/settlement";
import type { IMentorPaymentInfoResponse } from "@domains/financial/dto/settlement";

/**
 * Create Or Update Mentor Payment Info Command (Application Layer)
 * [创建或更新导师支付信息命令]
 *
 * Orchestrates mentor payment info creation or update use case
 * [编排导师支付信息创建或更新用例]
 */
@Injectable()
export class CreateOrUpdateMentorPaymentInfoCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly mentorPaymentInfoService: MentorPaymentInfoService,
  ) {
    super(db);
  }

  /**
   * Execute create or update mentor payment info use case
   * [执行创建或更新导师支付信息用例]
   *
   * @param input - Create or update mentor payment info input
   * @returns Mentor payment info response
   */
  async execute(
    input: ICreateOrUpdateMentorPaymentInfoRequest,
  ): Promise<IMentorPaymentInfoResponse> {
    try {
      this.logger.debug(
        `Creating/updating payment info for mentor: ${input.mentorId}`,
      );
      const paymentInfo =
        await this.mentorPaymentInfoService.createOrUpdateMentorPaymentInfo(
          input,
        );
      this.logger.debug(
        `Payment info created/updated successfully: ${paymentInfo.id}`,
      );
      return paymentInfo;
    } catch (error) {
      this.logger.error(
        `Failed to create/update mentor payment info: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

