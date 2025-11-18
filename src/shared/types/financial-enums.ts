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
