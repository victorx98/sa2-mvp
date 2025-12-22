import { Inject, Injectable, BadRequestException } from "@nestjs/common";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { CommandBase } from "@application/core/command.base";
import type { IPaymentParamUpdate } from "@api/dto/request/financial/settlement.request.dto";
import { and, eq } from "drizzle-orm";
import * as schema from "@infrastructure/database/schema";

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

      const { currency, settlementMonth, params, createdBy } = input;

      // 1. Validate parameters
      if (
        !params.defaultExchangeRate ||
        params.defaultExchangeRate <= 0 ||
        !params.defaultDeductionRate ||
        params.defaultDeductionRate < 0 ||
        params.defaultDeductionRate > 1
      ) {
        throw new BadRequestException(
          "Invalid parameters: exchange rate must be > 0 and deduction rate must be between 0 and 1",
        );
      }

      // Validate currency format (ISO 4217: 3 letters)
      if (!/^[A-Z]{3}$/.test(currency)) {
        throw new BadRequestException(
          `Invalid currency code: ${currency}. Must be 3-letter ISO 4217 code.`,
        );
      }

      // Validate settlement month format (YYYY-MM)
      if (!/^\d{4}-\d{2}$/.test(settlementMonth)) {
        throw new BadRequestException(
          `Invalid settlement month: ${settlementMonth}. Must be in YYYY-MM format.`,
        );
      }

      this.logger.log(
        `Updating/creating payment params for ${currency} ${settlementMonth}: ` +
          `exchangeRate=${params.defaultExchangeRate}, ` +
          `deductionRate=${params.defaultDeductionRate}`,
      );

      // 2. Check if parameters exist
      const existingParams = await this.db.query.paymentParams.findFirst({
        where: and(
          eq(schema.paymentParams.currency, currency),
          eq(schema.paymentParams.settlementMonth, settlementMonth),
        ),
      });

      if (existingParams) {
        // Update existing parameters
        await this.db
          .update(schema.paymentParams)
          .set({
            defaultExchangeRate: String(params.defaultExchangeRate),
            defaultDeductionRate: String(params.defaultDeductionRate),
            updatedAt: new Date(),
            updatedBy: createdBy,
          })
          .where(eq(schema.paymentParams.id, existingParams.id));

        this.logger.log(
          `Updated payment params: ${currency} ${settlementMonth}`,
        );
      } else {
        // Create new parameters
        await this.db.insert(schema.paymentParams).values({
          currency,
          settlementMonth,
          defaultExchangeRate: String(params.defaultExchangeRate),
          defaultDeductionRate: String(params.defaultDeductionRate),
          createdBy,
          updatedBy: createdBy,
        });

        this.logger.log(
          `Created payment params: ${currency} ${settlementMonth}`,
        );
      }

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

