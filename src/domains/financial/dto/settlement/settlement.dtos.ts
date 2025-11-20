import { SettlementStatus, SettlementMethod } from "./settlement.enums";

/**
 * Create Settlement Request DTO (创建结算请求DTO)
 * Request payload for generating a settlement
 * (生成结算的请求载荷)
 */
export interface CreateSettlementRequest {
  /**
   * Mentor ID (导师ID)
   */
  mentorId: string;

  /**
   * Settlement Month (结算月份)
   * Format: YYYY-MM (e.g., 2024-01)
   * (格式：YYYY-MM)
   */
  settlementMonth: string;

  /**
   * Exchange Rate (汇率)
   * Rate used to convert from original currency to target currency
   * (用于从原始币种转换到目标币种的汇率)
   */
  exchangeRate: number;

  /**
   * Deduction Rate (扣除比率)
   * Percentage of amount to be deducted (e.g., platform fee)
   * (扣除百分比，如平台费用)
   */
  deductionRate: number;

  /**
   * Note: Creator information will be passed via service interface parameters,
   * not as part of the request DTO
   * (创建人信息将通过服务接口的参数传递，而不是请求DTO的一部分)
   */
}

/**
 * Settlement Query Parameters (结算查询参数)
 * Used for searching and filtering settlement records
 * (用于搜索和筛选结算记录)
 */
export interface SettlementQuery {
  /**
   * Mentor ID (导师ID)
   * Optional filter by mentor
   * (可选：按导师筛选)
   */
  mentorId?: string;

  /**
   * Settlement Month (结算月份)
   * Optional filter by settlement month
   * (可选：按结算月份筛选)
   */
  settlementMonth?: string;

  /**
   * Start Date (开始日期)
   * Optional filter for settlement records created on or after this date
   * (可选：筛选在此日期或之后创建的结算记录)
   */
  startDate?: string;

  /**
   * End Date (结束日期)
   * Optional filter for settlement records created on or before this date
   * (可选：筛选在此日期或之前创建的结算记录)
   */
  endDate?: string;

  /**
   * Page Number (页码)
   * For pagination, starting from 1
   * (分页，从1开始)
   */
  page: number;

  /**
   * Page Size (每页大小)
   * Number of records per page
   * (每页记录数)
   */
  pageSize: number;
}

/**
 * Settlement Response DTO (结算响应DTO)
 * Response payload for settlement queries
 * (结算查询的响应载荷)
 */
export interface SettlementResponse {
  /**
   * Settlement ID (结算ID)
   */
  id: string;

  /**
   * Mentor ID (导师ID)
   */
  mentorId: string;

  /**
   * Settlement Month (结算月份)
   * Format: YYYY-MM
   * (格式：YYYY-MM)
   */
  settlementMonth: string;

  /**
   * Original Amount (原始金额)
   * Amount in original currency
   * (原始币种金额)
   */
  originalAmount: number;

  /**
   * Target Amount (目标金额)
   * Amount in target currency (after conversion and deduction)
   * (目标币种金额，转换和扣除后的金额)
   */
  targetAmount: number;

  /**
   * Original Currency (原始币种)
   * ISO 4217 currency code
   * (ISO 4217货币代码)
   */
  originalCurrency: string;

  /**
   * Target Currency (目标币种)
   * ISO 4217 currency code
   * (ISO 4217货币代码)
   */
  targetCurrency: string;

  /**
   * Exchange Rate (汇率)
   * Rate used for currency conversion
   * (用于币种转换的汇率)
   */
  exchangeRate: number;

  /**
   * Deduction Rate (扣除比率)
   * Percentage deducted from the amount
   * (从金额中扣除的百分比)
   */
  deductionRate: number;

  /**
   * Status (状态)
   * Settlement status (always CONFIRMED)
   * (结算状态，始终为CONFIRMED)
   */
  status: SettlementStatus;

  /**
   * Settlement Method (结算方式)
   * Payment method used for settlement
   * (结算使用的支付方式)
   */
  settlementMethod: SettlementMethod;

  /**
   * Created At (创建时间)
   * Timestamp when the settlement was created
   * (结算记录创建时间戳)
   */
  createdAt: Date;
}

/**
 * Settlement Detail Response DTO (结算详情响应DTO)
 * Detailed response including creator information
 * (包含创建人信息的详细响应)
 */
export interface SettlementDetailResponse {
  /**
   * Settlement ID (结算ID)
   */
  id: string;

  /**
   * Mentor ID (导师ID)
   */
  mentorId: string;

  /**
   * Settlement Month (结算月份)
   * Format: YYYY-MM
   * (格式：YYYY-MM)
   */
  settlementMonth: string;

  /**
   * Original Amount (原始金额)
   */
  originalAmount: number;

  /**
   * Target Amount (目标金额)
   */
  targetAmount: number;

  /**
   * Original Currency (原始币种)
   */
  originalCurrency: string;

  /**
   * Target Currency (目标币种)
   */
  targetCurrency: string;

  /**
   * Exchange Rate (汇率)
   */
  exchangeRate: number;

  /**
   * Deduction Rate (扣除比率)
   */
  deductionRate: number;

  /**
   * Status (状态)
   * Settlement status (always CONFIRMED)
   */
  status: SettlementStatus;

  /**
   * Settlement Method (结算方式)
   */
  settlementMethod: SettlementMethod;

  /**
   * Created At (创建时间)
   */
  createdAt: Date;

  /**
   * Created By (创建人)
   * User ID of the creator
   * (创建人的用户ID)
   */
  createdBy: string;
}

/**
 * Settlement Detail Item DTO (结算明细项DTO)
 * Represents a link between settlement and payable ledger
 * (表示结算记录与应付账款之间的关联)
 */
export interface SettlementDetailItem {
  /**
   * Detail ID (明细ID)
   */
  id: string;

  /**
   * Settlement ID (结算ID)
   * References the settlement record
   * (关联的结算记录ID)
   */
  settlementId: string;

  /**
   * Mentor Payable Ledger ID (导师应付账款流水ID)
   * References the payable ledger record
   * (关联的应付账款记录ID)
   */
  mentorPayableId: string;

  /**
   * Created At (创建时间)
   */
  createdAt: Date;

  /**
   * Created By (创建人)
   */
  createdBy: string;
}

/**
 * Payment Parameter Update DTO (支付参数更新DTO)
 * Request payload for updating payment parameters
 * (更新支付参数的请求载荷)
 */
export interface PaymentParamUpdate {
  /**
   * Default Exchange Rate (默认汇率)
   */
  defaultExchangeRate: number;

  /**
   * Default Deduction Rate (默认扣除比率)
   */
  defaultDeductionRate: number;
}

/**
 * Payment Parameter Response DTO (支付参数响应DTO)
 * Response payload for payment parameter queries
 * (支付参数查询的响应载荷)
 */
export interface PaymentParamResponse {
  /**
   * Mentor ID (导师ID)
   */
  mentorId: string;

  /**
   * Settlement Month (结算月份)
   * Format: YYYY-MM
   * (格式：YYYY-MM)
   */
  settlementMonth: string;

  /**
   * Default Exchange Rate (默认汇率)
   */
  defaultExchangeRate: number;

  /**
   * Default Deduction Rate (默认扣除比率)
   */
  defaultDeductionRate: number;
}
