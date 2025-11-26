// Financial Domain Enums

/**
 * 服务流水类型枚举
 * 定义服务流水的不同类型
 */
export enum ServiceLedgerType {
  CONSUMPTION = "consumption",
  REFUND = "refund",
  ADJUSTMENT = "adjustment",
}

/**
 * 服务流水来源枚举
 * 定义服务流水的不同来源
 */
export enum ServiceLedgerSource {
  BOOKING_COMPLETED = "booking_completed",
  BOOKING_CANCELLED = "booking_cancelled",
  MANUAL_ADJUSTMENT = "manual_adjustment",
}

/**
 * 归档策略范围枚举
 * 定义归档策略的适用范围（已废弃）
 */
export enum ArchivePolicyScope {
  GLOBAL = "global",
  CONTRACT = "contract",
  SERVICE_TYPE = "service_type",
}

/**
 * 价格状态枚举
 * 定义价格的激活状态
 */
export enum PriceStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

/**
 * 申诉类型枚举
 * 定义导师申诉的不同类型
 */
export enum AppealType {
  BILLING_ERROR = "billing_error", // 费用计算错误
  MISSING_SERVICE = "missing_service", // 遗漏服务记录
  PRICE_DISPUTE = "price_dispute", // 价格争议
  OTHER = "other", // 其他
}

/**
 * 申诉状态枚举
 * 定义申诉处理的三种状态
 */
export enum AppealStatus {
  PENDING = "PENDING", // 待处理
  APPROVED = "APPROVED", // 已批准
  REJECTED = "REJECTED", // 已驳回
}
