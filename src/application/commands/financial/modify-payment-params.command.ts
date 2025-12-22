import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import type { IPaymentParamUpdate } from "@api/dto/request/financial/settlement.request.dto";
import { and, eq } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";

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

      const { currency, settlementMonth, params, updatedBy } = input;

      // 1. Get existing parameters
      const existingParams = await this.db.query.paymentParams.findFirst({
        where: and(
          eq(schema.paymentParams.currency, currency),
          eq(schema.paymentParams.settlementMonth, settlementMonth),
        ),
      });

      if (!existingParams) {
        throw new BadRequestException(
          `Payment params not found for ${currency} ${settlementMonth}. ` +
            `Use updateOrCreateDefaultParams to create initial parameters.`,
        );
      }

      // 2. Validate provided parameters
      if (
        params.defaultExchangeRate !== undefined &&
        params.defaultExchangeRate <= 0
      ) {
        throw new BadRequestException("Exchange rate must be greater than 0");
      }

      if (params.defaultDeductionRate !== undefined) {
        if (
          params.defaultDeductionRate < 0 ||
          params.defaultDeductionRate > 1
        ) {
          throw new BadRequestException(
            "Deduction rate must be between 0 and 1",
          );
        }
      }

      this.logger.log(
        `Modifying payment params for ${currency} ${settlementMonth}`,
      );

      // 3. Update parameters
      const updates: Record<string, string | Date | number> = {
        updatedAt: new Date(),
        updatedBy,
      };

      if (params.defaultExchangeRate !== undefined) {
        updates.defaultExchangeRate = String(params.defaultExchangeRate);
      }

      if (params.defaultDeductionRate !== undefined) {
        updates.defaultDeductionRate = String(params.defaultDeductionRate);
      }

      await this.db
        .update(schema.paymentParams)
        .set(updates)
        .where(eq(schema.paymentParams.id, existingParams.id));

      this.logger.log(
        `Successfully modified payment params for ${currency} ${settlementMonth}`,
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

