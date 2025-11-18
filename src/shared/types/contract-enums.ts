// Contract Domain Enums

/**
 * 合同状态枚举
 * 定义合同在生命周期中的不同状态
 */
export enum ContractStatus {
  DRAFT = "draft",
  SIGNED = "signed",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  COMPLETED = "completed",
  TERMINATED = "terminated",
}

/**
 * 服务持有状态枚举
 * 定义服务持有的不同状态
 */
export enum HoldStatus {
  ACTIVE = "active",
  RELEASED = "released",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/**
 * 合同修正案类型枚举
 * 定义合同修正案的不同类型
 */
export enum AmendmentLedgerType {
  ADDON = "addon",
  PROMOTION = "promotion",
  COMPENSATION = "compensation",
}
