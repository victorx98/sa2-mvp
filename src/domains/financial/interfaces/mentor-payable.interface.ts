/**
 * Mentor Payable Interface(导师应付账款接口)
 *
 * 定义导师应付账款相关的数据结构和接口
 */

/**
 * 导师应付账款记录接口
 * Note: This interface maps to mentor_payable_ledgers table which does NOT have contract_id column
 * The relation_id field links to sessions, classes, or other entities based on source_entity
 */
export interface IMentorPayableLedger {
  // 记录ID
  id: string;

  // 关联信息 (relation_id links to different entities based on source_entity)
  sessionId?: string; // When sourceEntity = 'session', this is the relation_id
  classId?: string; // When sourceEntity = 'class', this is the relation_id
  mentorUserId: string;
  studentUserId: string;

  // 服务信息
  serviceTypeCode: string; // Service type code (references service_types.code field)
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
  serviceTypeCode: string; // Service type code (references service_types.code field)
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
  serviceTypeCode: string; // Service type code (references service_types.code field)
  servicePackageId?: string; // 服务包ID(可选)

  // 价格信息
  price: number;
  currency: string;

  // 状态信息
  status: string; // 使用字符串类型，与数据库表结构一致

  // 审计信息
  createdBy?: string; // 创建者ID(可选)
  updatedBy?: string; // 更新者ID(可选)

  // 时间信息
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建按会话计费DTO
 */
export interface ICreatePerSessionBillingDTO {
  sessionId: string;
  contractId: string;
  mentorUserId: string;
  studentUserId: string;
  serviceTypeCode: string; // Service type code (references service_types.code field)
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
  serviceTypeCode: string; // Service type code (references service_types.code field)
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
 * 创建导师价格DTO(DTO for creating mentor price)
 * Uses billingModeEnum values: one_time, per_session, staged
 */
export interface ICreateMentorPriceDTO {
  mentorUserId: string;
  serviceTypeCode: string; // Service type code (references service_types.code field)
  billingMode: "one_time" | "per_session" | "staged";
  price: number;
  currency?: string;
  status?: "active" | "inactive";
  updatedBy?: string;
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
  createPackageBilling(
    dto: ICreatePackageBillingDTO,
  ): Promise<IPackageBilling>;

  /**
   * 调整应付账款
   * @param dto 调整DTO
   * @returns 调整后的应付账款记录
   */
  adjustPayableLedger(
    dto: IAdjustPayableLedgerDTO,
  ): Promise<IMentorPayableLedger>;

  /**
   * 获取导师价格
   * @param mentorId 导师ID
   * @param serviceTypeCode 服务类型代码(引用service_types.code)
   * @returns 导师价格或null
   */
  getMentorPrice(
    mentorId: string,
    serviceTypeCode: string,
  ): Promise<IMentorPrice | null>;

  /**
   * Query mentor payable ledgers
   * 查询导师应付账款
   */
  queryMentorPayableLedgers(params: {
    mentorUserId?: string;
    startDate?: Date;
    endDate?: Date;
    sourceEntity?: "session" | "contract";
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ data: IMentorPayableLedger[]; total: number }>;

  /**
   * 创建导师价格配置
   * Create mentor price configuration
   *
   * @param dto - Create mentor price DTO
   * @returns Created mentor price record
   */
  createMentorPrice(
    dto: ICreateMentorPriceDTO,
  ): Promise<IMentorPrice>;

  /**
   * Get session billing record
   * 获取会话计费记录
   */
  getSessionBilling(
    sessionId: string,
  ): Promise<IMentorPayableLedger | null>;

  /**
   * Get package billing records
   * 获取服务包计费记录
   */
  getPackageBilling(
    contractId: string,
  ): Promise<IPackageBilling | null>;

  /**
   * Get adjustment chain records
   * 获取调整记录链
   */
  getAdjustmentChain(
    originalLedgerId: string,
  ): Promise<IMentorPayableLedger[]>;
}