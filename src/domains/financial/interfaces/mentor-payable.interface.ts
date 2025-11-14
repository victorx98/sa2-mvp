/**
 * Mentor Payable Interface(导师应付账款接口)
 *
 * 定义导师应付账款相关的数据结构和接口
 */

/**
 * 导师应付账款记录接口
 */
export interface IMentorPayableLedger {
  // 记录ID
  id: string;

  // 关联信息
  sessionId?: string;
  classId?: string;
  contractId: string;
  mentorUserId: string;
  studentUserId: string;

  // 服务信息
  serviceTypeCode: string;
  serviceName?: string;
  durationHours: number; // 单位：小时

  // 金额信息
  unitPrice: number; // 单价
  totalAmount: number; // 总金额
  currency: string;

  // 状态信息
  status: "pending" | "settled" | "adjusted";
  settlementId?: string;

  // 计费信息
  billingType: "session" | "package";
  billingId?: string;

  // 调整信息
  adjustmentReason?: string;
  originalLedgerId?: string;

  // 时间信息
  createdAt: Date;
  updatedAt: Date;

  // 元数据
  metadata?: Record<string, unknown>;
}

/**
 * 服务包计费记录接口
 */
export interface IPackageBilling {
  // 记录ID
  id: string;

  // 关联信息
  contractId: string;
  mentorUserId: string;
  studentUserId: string;

  // 服务信息
  serviceTypeCode: string;
  serviceName?: string;
  quantity: number;

  // 金额信息
  unitPrice: number;
  totalAmount: number;
  currency: string;

  // 状态信息
  status: "pending" | "completed" | "cancelled";

  // 时间信息
  createdAt: Date;
  updatedAt: Date;

  // 元数据
  metadata?: Record<string, unknown>;
}

/**
 * 导师价格接口
 */
export interface IMentorPrice {
  // 记录ID
  id: string;

  // 导师信息
  mentorUserId: string;

  // 服务信息
  serviceTypeCode: string;

  // 价格信息
  price: number;
  currency: string;

  // 时间信息
  createdAt: Date;
  updatedAt: Date;

  // 状态信息
  isActive: boolean;
}

/**
 * 创建按会话计费DTO
 */
export interface ICreatePerSessionBillingDTO {
  sessionId: string;
  contractId: string;
  mentorUserId: string;
  studentUserId: string;
  serviceTypeCode: string;
  serviceName?: string;
  durationHours: number;
  startTime: Date;
  endTime: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 创建服务包计费DTO
 */
export interface ICreatePackageBillingDTO {
  contractId: string;
  servicePackageId: string;
  mentorUserId: string;
  studentUserId: string;
  serviceTypeCode: string;
  serviceName?: string;
  quantity: number;
  metadata?: Record<string, unknown>;
}

/**
 * 调整应付账款DTO(DTO for adjusting payable ledger)
 *
 * 调整金额 adjustmentAmount 表示实际调整的值（正负值）而不是乘法系数
 * Adjustment amount represents the actual adjustment value (positive or negative), not a multiplier
 *
 * @example
 * 原始记录: 100 USD
 * 退款 50 USD: adjustmentAmount = -50
 * 补扣 20 USD: adjustmentAmount = 20
 */
export interface IAdjustPayableLedgerDTO {
  ledgerId: string;
  /**
   * 调整金额(实际调整值，非乘法系数)
   * Actual adjustment value (can be negative for refunds)
   * @example -50 (退款50), 20 (补扣20)
   */
  adjustmentAmount: number;
  reason: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

/**
 * 导师应付账款服务接口
 */
export interface IMentorPayableService {
  /**
   * 创建按会话计费记录
   * @param dto 按会话计费DTO
   * @returns 创建的应付账款记录
   */
  createPerSessionBilling(
    dto: ICreatePerSessionBillingDTO,
  ): Promise<IMentorPayableLedger>;

  /**
   * 创建服务包计费记录
   * @param dto 服务包计费DTO
   * @returns 创建的服务包计费记录
   */
  createPackageBilling(dto: ICreatePackageBillingDTO): Promise<IPackageBilling>;

  /**
   * 调整应付账款
   * @param dto 调整DTO
   * @returns 调整后的应付账款记录
   */
  adjustPayableLedger(
    dto: IAdjustPayableLedgerDTO,
  ): Promise<IMentorPayableLedger>;


}
