import { PaymentParamUpdate } from "../dto/settlement";

/**
 * Mentor Payment Parameter Service Interface (导师支付参数服务接口)
 *
 * Main responsibilities:
 * - Manage payment calculation parameters (managing payment calculation parameters)
 * - Update/create default parameters (updating or creating default parameters)
 * - Modify monthly default parameters (modifying monthly default parameters)
 * - Validate parameter values (validating parameter values)
 *
 * 主要职责：
 * - 管理支付计算参数
 * - 更新/创建默认参数
 * - 修改当月默认参数
 * - 验证参数值
 */
export interface IMentorPaymentParamService {
  /**
   * Update or create default parameters (更新或创建默认参数)
   *
   * Creates new parameter record if it doesn't exist for the currency and month.
   * Updates existing record if parameters already exist.
   * Used for setting initial parameters.
   *
   * 如果指定币种和月份的参数不存在，则创建新记录。如果已存在，则更新记录。
   * 用于设置初始参数。
   *
   * @param currency - Currency code (ISO 4217) [币种代码 (ISO 4217)]
   * @param settlementMonth - Settlement month in YYYY-MM format [结算月份 (格式YYYY-MM)]
   * @param params - Parameter values (参数值)
   * @param updatedBy - User ID making the update [执行更新的用户ID]
   * @returns Promise<void>
   */
  updateOrCreateDefaultParams(
    currency: string,
    settlementMonth: string,
    params: PaymentParamUpdate,
    updatedBy: string,
  ): Promise<void>;

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
  modifyDefaultParams(
    currency: string,
    settlementMonth: string,
    params: Partial<PaymentParamUpdate>,
    updatedBy: string,
  ): Promise<void>;

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
   * @returns Payment parameter response or null [支付参数响应，或null]
   */
  getDefaultParams(
    currency: string,
    settlementMonth: string,
  ): Promise<{
    currency: string;
    settlementMonth: string;
    defaultExchangeRate: number;
    defaultDeductionRate: number;
  } | null>;

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
  validateParams(params: PaymentParamUpdate): boolean;
}
