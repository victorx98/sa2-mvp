import {
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { eq, and } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { DrizzleDatabase } from "@shared/types/database.types";
import type { IMentorPaymentParamService } from "../interfaces/mentor-payment-param.interface";
import type { IPaymentParamUpdate } from "../dto/settlement";

/**
 * Mentor Payment Parameter Service Implementation (导师支付参数服务实现)
 *
 * Manages payment calculation parameters including exchange rates and deduction rates.
 * Supports monthly default parameters that can be modified and applied to subsequent batches.
 * Parameters are currency-specific and time-bound.
 *
 * 管理支付计算参数，包括汇率和扣除比率。
 * 支持可修改的月度默认参数，修改后应用于后续批次。
 * 参数是币种特定和时间绑定的。
 */
@Injectable()
export class MentorPaymentParamService implements IMentorPaymentParamService {
  private readonly logger = new Logger(MentorPaymentParamService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Update or create default parameters (更新或创建默认参数)
   *
   * Creates new parameter record if it doesn't exist for the currency and month.
   * Updates existing record if parameters already exist. Used for setting initial parameters.
   *
   * 如果指定币种和月份的参数不存在，则创建新记录。如果已存在，则更新记录。
   * 用于设置初始参数。
   *
   * @param currency - Currency code (ISO 4217) [币种代码 (ISO 4217)]
   * @param settlementMonth - Settlement month in YYYY-MM format [结算月份 (格式YYYY-MM)]
   * @param params - Parameter values (参数值)
   * @param createdBy - User ID making the update [执行更新的用户ID]
   * @returns Promise<void>
   */
  public async updateOrCreateDefaultParams(
    currency: string,
    settlementMonth: string,
    params: IPaymentParamUpdate,
    createdBy: string,
  ): Promise<void> {
    try {
      // 1. Validate parameters (验证参数)
      if (!this.validateParams(params)) {
        throw new BadRequestException(
          "Invalid parameters: exchange rate must be > 0 and deduction rate must be between 0 and 1",
        );
      }

      if (!this.isValidCurrency(currency)) {
        throw new BadRequestException(
          `Invalid currency code: ${currency}. Must be 3-letter ISO 4217 code.`,
        );
      }

      if (!this.isValidSettlementMonth(settlementMonth)) {
        throw new BadRequestException(
          `Invalid settlement month: ${settlementMonth}. Must be in YYYY-MM format.`,
        );
      }

      this.logger.log(
        `Updating/creating payment params for ${currency} ${settlementMonth}: ` +
          `exchangeRate=${params.defaultExchangeRate}, ` +
          `deductionRate=${params.defaultDeductionRate}`,
      );

      // 2. Check if parameters exist (检查参数是否存在)
      const existingParams = await this.db.query.paymentParams.findFirst({
        where: and(
          eq(schema.paymentParams.currency, currency),
          eq(schema.paymentParams.settlementMonth, settlementMonth),
        ),
      });

      if (existingParams) {
        // Update existing parameters (更新现有参数)
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
        // Create new parameters (创建新参数)
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
    } catch (error) {
      this.logger.error(
        `Error updating/creating payment params for ${currency} ${settlementMonth}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Modify monthly default parameters (修改当月默认参数)
   *
   * Updates parameters for a specific currency and month.
   * Modified parameters will apply to subsequent settlement batches.
   * Does NOT affect already created settlement records (append-only mode).
   *
   * 更新特定币种和月份的参数。修改后的参数将应用于后续结算批次。
   * 不影响已创建的结算记录（append-only模式）。
   *
   * @param currency - Currency code (ISO 4217) [币种代码 (ISO 4217)]
   * @param settlementMonth - Settlement month in YYYY-MM format [结算月份 (格式YYYY-MM)]
   * @param params - Parameter values (partial update supported) [参数值(支持部分更新)]
   * @param updatedBy - User ID making the update [执行更新的用户ID]
   * @returns Promise<void>
   */
  public async modifyDefaultParams(
    currency: string,
    settlementMonth: string,
    params: Partial<IPaymentParamUpdate>,
    updatedBy: string,
  ): Promise<void> {
    try {
      // 1. Get existing parameters (获取现有参数)
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

      // 2. Validate provided parameters (验证提供的参数)
      if (params.defaultExchangeRate !== undefined && params.defaultExchangeRate <= 0) {
        throw new BadRequestException(
          "Exchange rate must be greater than 0",
        );
      }

      if (params.defaultDeductionRate !== undefined) {
        if (params.defaultDeductionRate < 0 || params.defaultDeductionRate > 1) {
          throw new BadRequestException(
            "Deduction rate must be between 0 and 1",
          );
        }
      }

      this.logger.log(
        `Modifying payment params for ${currency} ${settlementMonth}`,
      );

      // 3. Update parameters (更新参数)
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
    } catch (error) {
      this.logger.error(
        `Error modifying payment params for ${currency} ${settlementMonth}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get default parameters (获取默认参数)
   *
   * Retrieves the default payment parameters for a specific currency and month.
   * Returns null if no parameters exist.
   *
   * 检索特定币种和月份的默认支付参数。如果不存在参数，返回null。
   *
   * @param currency - Currency code (ISO 4217) [币种代码 (ISO 4217)]
   * @param settlementMonth - Settlement month in YYYY-MM format [结算月份 (格式YYYY-MM)]
   * @returns Payment parameters or null [支付参数，或null]
   */
  public async getDefaultParams(
    currency: string,
    settlementMonth: string,
  ): Promise<{
    currency: string;
    settlementMonth: string;
    defaultExchangeRate: number;
    defaultDeductionRate: number;
  } | null> {
    try {
      if (!this.isValidCurrency(currency)) {
        return null;
      }

      if (!this.isValidSettlementMonth(settlementMonth)) {
        return null;
      }

      const params = await this.db.query.paymentParams.findFirst({
        where: and(
          eq(schema.paymentParams.currency, currency),
          eq(schema.paymentParams.settlementMonth, settlementMonth),
        ),
      });

      if (!params) {
        this.logger.warn(
          `Payment params not found for ${currency} ${settlementMonth}`,
        );
        return null;
      }

      return {
        currency: params.currency,
        settlementMonth: params.settlementMonth,
        defaultExchangeRate: Number(params.defaultExchangeRate),
        defaultDeductionRate: Number(params.defaultDeductionRate),
      };
    } catch (error) {
      this.logger.error(
        `Error getting payment params for ${currency} ${settlementMonth}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Validate parameters (验证支付参数)
   *
   * Validates payment parameter values for correctness.
   * Checks exchange rate and deduction rate ranges and values.
   *
   * 验证支付参数值的正确性。检查汇率和扣除比率的范围和值。
   *
   * @param params - Parameters to validate [待验证的参数]
   * @returns True if parameters are valid, false otherwise [有效返回true，否则false]
   */
  public validateParams(params: IPaymentParamUpdate): boolean {
    try {
      const { defaultExchangeRate, defaultDeductionRate } = params;

      // Validate exchange rate (验证汇率)
      if (
        defaultExchangeRate === undefined ||
        defaultExchangeRate === null ||
        typeof defaultExchangeRate !== "number" ||
        defaultExchangeRate <= 0
      ) {
        this.logger.warn(`Invalid exchange rate: ${defaultExchangeRate}`);
        return false;
      }

      // Validate deduction rate (验证扣除比率)
      if (
        defaultDeductionRate === undefined ||
        defaultDeductionRate === null ||
        typeof defaultDeductionRate !== "number" ||
        defaultDeductionRate < 0 ||
        defaultDeductionRate > 1
      ) {
        this.logger.warn(`Invalid deduction rate: ${defaultDeductionRate}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        "Error validating payment params",
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  /**
   * Validate currency code (验证币种代码)
   *
   * @param currency - Currency code to validate [待验证的币种代码]
   * @returns True if valid, false otherwise [有效返回true，否则false]
   */
  private isValidCurrency(currency: string): boolean {
    if (!currency || typeof currency !== "string") {
      return false;
    }
    // ISO 4217 currency codes are 3 letters [ISO 4217币种代码为3个字母]
    return /^[A-Z]{3}$/.test(currency.toUpperCase());
  }

  /**
   * Validate settlement month format (验证结算月份格式)
   *
   * @param month - Settlement month to validate [待验证的结算月份]
   * @returns True if valid YYYY-MM format, false otherwise [格式YYYY-MM有效返回true，否则false]
   */
  private isValidSettlementMonth(month: string): boolean {
    if (!month || typeof month !== "string") {
      return false;
    }
    // YYYY-MM format [格式YYYY-MM]
    return /^\d{4}-\d{2}$/.test(month);
  }
}
