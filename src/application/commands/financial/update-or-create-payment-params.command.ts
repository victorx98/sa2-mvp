import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorPaymentParamService } from "@domains/financial/services/mentor-payment-param.service";
import type { IPaymentParamUpdate } from "@domains/financial/dto/settlement";

/**
 * Update Or Create Payment Params Command (Application Layer)
 * [创建或更新支付参数命令]
 *
 * Orchestrates payment parameter creation or update use case
 * [编排支付参数创建或更新用例]
 */
@Injectable()
export class UpdateOrCreatePaymentParamsCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly mentorPaymentParamService: MentorPaymentParamService,
  ) {
    super(db);
  }

  /**
   * Execute update or create payment params use case
   * [执行创建或更新支付参数用例]
   *
   * @param input - Update or create payment params input
   */
  async execute(input: {
    currency: string;
    settlementMonth: string;
    params: IPaymentParamUpdate;
    createdBy: string;
  }): Promise<void> {
    try {
      this.logger.debug(
        `Updating/creating payment params for ${input.currency} ${input.settlementMonth}`,
      );
      await this.mentorPaymentParamService.updateOrCreateDefaultParams(
        input.currency,
        input.settlementMonth,
        input.params,
        input.createdBy,
      );
      this.logger.debug(
        `Payment params updated/created successfully: ${input.currency} ${input.settlementMonth}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update/create payment params: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

