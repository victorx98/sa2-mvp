/**
 * LedgerSource Value Object (台账来源值对象)
 * Represents the source/reason for a service ledger entry (表示服务流水条目的来源/原因)
 */

import { DomainException } from '@core/exceptions/domain.exception';

// Valid ledger sources (有效的台账来源)
type LedgerSourceValue = 'booking_completed' | 'booking_cancelled' | 'manual_adjustment';

export class LedgerSource {
  private static readonly SOURCES = {
    BOOKING_COMPLETED: 'booking_completed' as const, // Booking completed (预约完成)
    BOOKING_CANCELLED: 'booking_cancelled' as const, // Booking cancelled (预约取消)
    MANUAL_ADJUSTMENT: 'manual_adjustment' as const, // Manual adjustment (手动调整)
  };

  static BOOKING_COMPLETED = new LedgerSource(this.SOURCES.BOOKING_COMPLETED);
  static BOOKING_CANCELLED = new LedgerSource(this.SOURCES.BOOKING_CANCELLED);
  static MANUAL_ADJUSTMENT = new LedgerSource(this.SOURCES.MANUAL_ADJUSTMENT);

  private constructor(private readonly value: LedgerSourceValue) {}

  /**
   * Create a LedgerSource from string (从字符串创建LedgerSource)
   *
   * @param value - Source value string (来源值字符串)
   * @returns LedgerSource instance (LedgerSource实例)
   * @throws InvalidLedgerSourceException if value is invalid (值无效时抛出InvalidLedgerSourceException)
   */
  static fromString(value: string): LedgerSource {
    const normalizedValue = value.toLowerCase();
    switch (normalizedValue) {
      case this.SOURCES.BOOKING_COMPLETED:
        return this.BOOKING_COMPLETED;
      case this.SOURCES.BOOKING_CANCELLED:
        return this.BOOKING_CANCELLED;
      case this.SOURCES.MANUAL_ADJUSTMENT:
        return this.MANUAL_ADJUSTMENT;
      default:
        throw new InvalidLedgerSourceException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Source value string (来源值字符串)
   * @returns LedgerSource instance (LedgerSource实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): LedgerSource {
    return new LedgerSource(value as LedgerSourceValue);
  }

  /**
   * Check if this is from a booking completion (检查是否来自预约完成)
   *
   * @returns true if from booking completion (来自预约完成时返回true)
   */
  isBookingCompleted(): boolean {
    return this.value === LedgerSource.SOURCES.BOOKING_COMPLETED;
  }

  /**
   * Check if this is from a booking cancellation (检查是否来自预约取消)
   *
   * @returns true if from booking cancellation (来自预约取消时返回true)
   */
  isBookingCancelled(): boolean {
    return this.value === LedgerSource.SOURCES.BOOKING_CANCELLED;
  }

  /**
   * Check if this is from a manual adjustment (检查是否来自手动调整)
   *
   * @returns true if from manual adjustment (来自手动调整时返回true)
   */
  isManualAdjustment(): boolean {
    return this.value === LedgerSource.SOURCES.MANUAL_ADJUSTMENT;
  }

  /**
   * Get the source value (获取来源值)
   *
   * @returns Source value string (来源值字符串)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check equality with another LedgerSource (检查与另一个LedgerSource是否相等)
   *
   * @param other - LedgerSource to compare (要比较的LedgerSource)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: LedgerSource): boolean {
    return this.value === other.value;
  }

  /**
   * Get string representation (获取字符串表示)
   *
   * @returns Source value (来源值)
   */
  toString(): string {
    return this.value;
  }
}

/**
 * InvalidLedgerSourceException (无效台账来源异常)
 */
export class InvalidLedgerSourceException extends DomainException {
  constructor(value: string) {
    super(
      'INVALID_LEDGER_SOURCE',
      `Invalid ledger source: ${value}. Must be 'booking_completed', 'booking_cancelled', or 'manual_adjustment'`,
      { value },
    );
  }
}
