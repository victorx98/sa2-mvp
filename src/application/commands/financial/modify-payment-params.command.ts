import { Inject, Injectable } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import { MentorPaymentParamService } from "@domains/financial/services/mentor-payment-param.service";
import type { IPaymentParamUpdate } from "@domains/financial/dto/settlement";

/**
 * Modify Payment Params Command (Application Layer)
 * [修改支付参数命令]
 *
 * Orchestrates payment parameter modification use case
 * [编排支付参数修改用例]
 */
@Injectable()
export class ModifyPaymentParamsCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly mentorPaymentParamService: MentorPaymentParamService,
  ) {
    super(db);
  }

  /**
   * Execute modify payment params use case
   * [执行修改支付参数用例]
   *
   * @param input - Modify payment params input
   */
  async execute(input: {
    currency: string;
    settlementMonth: string;
    params: Partial<IPaymentParamUpdate>;
    updatedBy: string;
  }): Promise<void> {
    try {
      this.logger.debug(
        `Modifying payment params for ${input.currency} ${input.settlementMonth}`,
      );
      await this.mentorPaymentParamService.modifyDefaultParams(
        input.currency,
        input.settlementMonth,
        input.params,
        input.updatedBy,
      );
      this.logger.debug(
        `Payment params modified successfully: ${input.currency} ${input.settlementMonth}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to modify payment params: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

