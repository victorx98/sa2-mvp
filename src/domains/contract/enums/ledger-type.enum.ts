// Ledger Type Enum (流水类型枚举)
// 与数据库定义保持一致

/**
 * 服务流水类型枚举 (Service ledger type enum)
 * - consumption: 服务消费（quantity < 0）[Service consumption (quantity < 0)]
 * - refund: 退款增加（quantity > 0）[Refund increase (quantity > 0)]
 * - adjustment: 手动调整（quantity 可正可负）[Manual adjustment (quantity can be positive or negative)]
 */
export enum LedgerType {
  CONSUMPTION = "consumption", // 服务消费[Service consumption]
  REFUND = "refund", // 退款增加[Refund increase]
  ADJUSTMENT = "adjustment", // 手动调整[Manual adjustment]
}
