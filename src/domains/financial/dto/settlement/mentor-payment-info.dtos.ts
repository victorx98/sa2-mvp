import { SettlementMethod } from "./settlement.enums";

/**
 * Create or Update Mentor Payment Info Request DTO (创建或更新导师支付信息请求DTO)
 * Request payload for creating or updating mentor payment information
 * (创建或更新导师支付信息的请求载荷)
 */
export interface CreateOrUpdateMentorPaymentInfoRequest {
  /**
   * Mentor ID (导师ID)
   */
  mentorId: string;

  /**
   * Payment Currency (支付币种)
   * ISO 4217 currency code (e.g., USD, CNY, EUR)
   * (ISO 4217货币代码，如USD、CNY、EUR)
   */
  paymentCurrency: string;

  /**
   * Payment Method (支付方式)
   * Payment method used for settlement
   * (结算使用的支付方式)
   */
  paymentMethod: SettlementMethod;

  /**
   * Payment Details (支付详情)
   * JSON object containing payment-specific details
   * Structure varies by payment method:
   * - Domestic Transfer: { bankName, accountNumber, accountHolder }
   * - Gusto: { employeeId, companyId }
   * - Check: { payee, address }
   * (JSON对象，根据支付方式存储不同的详情)
   */
  paymentDetails: Record<string, any>;
}

/**
 * Mentor Payment Info Response DTO (导师支付信息响应DTO)
 * Response payload for mentor payment information queries
 * (导师支付信息查询的响应载荷)
 */
export interface MentorPaymentInfoResponse {
  /**
   * Payment Info ID (支付信息ID)
   */
  id: string;

  /**
   * Mentor ID (导师ID)
   */
  mentorId: string;

  /**
   * Payment Currency (支付币种)
   * ISO 4217 currency code
   * (ISO 4217货币代码)
   */
  paymentCurrency: string;

  /**
   * Payment Method (支付方式)
   */
  paymentMethod: SettlementMethod;

  /**
   * Payment Details (支付详情)
   * JSON object containing payment-specific details
   * (JSON对象，包含特定于支付方式的详情)
   */
  paymentDetails: Record<string, any>;

  /**
   * Status (状态)
   * Current status: ACTIVE or INACTIVE
   * (当前状态：ACTIVE或INACTIVE)
   */
  status: string;

  /**
   * Created At (创建时间)
   */
  createdAt: Date;

  /**
   * Updated At (更新时间)
   */
  updatedAt: Date;
}
