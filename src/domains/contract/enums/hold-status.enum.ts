// Hold Status Enum (预占状态枚举)
// 与数据库定义保持一致

/**
 * 预占状态枚举 (Hold status enum)
 * - active: 生效中（未释放）[Active (not released)]
 * - released: 已释放（服务完成）[Released (service completed)]
 * - cancelled: 已取消（用户取消）[Cancelled (user cancelled)]
 */
export enum HoldStatus {
  ACTIVE = "active", // 生效中[Active]
  RELEASED = "released", // 已释放[Released]
  CANCELLED = "cancelled", // 已取消[Cancelled]
}
