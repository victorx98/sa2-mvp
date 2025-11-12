// Ledger Source Enum (流水来源枚举)
// 与数据库定义保持一致

/**
 * 服务流水来源枚举 (Service ledger source enum)
 * - booking_completed: 预约完成[Booking completed]
 * - booking_cancelled: 预约取消[Booking cancelled]
 * - manual_adjustment: 手动调整[Manual adjustment]
 */
export enum LedgerSource {
  BOOKING_COMPLETED = "booking_completed", // 预约完成[Booking completed]
  BOOKING_CANCELLED = "booking_cancelled", // 预约取消[Booking cancelled]
  MANUAL_ADJUSTMENT = "manual_adjustment", // 手动调整[Manual adjustment]
}
