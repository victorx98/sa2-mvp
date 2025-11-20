/**
 * Settlement Status Enum (结算状态枚举)
 * Only CONFIRMED status is used for settlement records
 * (结算记录仅使用CONFIRMED状态)
 */
export enum SettlementStatus {
  /**
   * Settlement record is confirmed and ready for payment processing
   * (结算记录已确认，等待支付处理)
   */
  CONFIRMED = "CONFIRMED",
}

/**
 * Settlement Method Enum (结算方式枚举)
 * Supported payment methods for mentor settlement
 * (支持的导师结算方式)
 */
export enum SettlementMethod {
  /**
   * Domestic bank transfer (国内银行转账)
   */
  DOMESTIC_TRANSFER = "DOMESTIC_TRANSFER",

  /**
   * Channel batch payment (渠道批量支付)
   */
  CHANNEL_BATCH_PAY = "CHANNEL_BATCH_PAY",

  /**
   * Gusto payment service (Gusto支付服务)
   */
  GUSTO = "GUSTO",

  /**
   * Gusto International payment service (Gusto国际支付服务)
   */
  GUSTO_INTERNATIONAL = "GUSTO_INTERNATIONAL",

  /**
   * Check payment (支票支付)
   */
  CHECK = "CHECK",
}
