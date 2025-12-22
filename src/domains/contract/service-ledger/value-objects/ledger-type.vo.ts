/**
 * LedgerType Value Object (台账类型值对象)
 * Represents the type of service ledger entry (表示服务流水条目的类型)
 */

import { DomainException } from '@core/exceptions/domain.exception';

// Valid ledger types (有效的台账类型)
type LedgerTypeValue = 'consumption' | 'refund' | 'adjustment';

export class LedgerType {
  private static readonly TYPES = {
    CONSUMPTION: 'consumption' as const, // Service consumption (quantity < 0) (服务消费（数量 < 0）)
    REFUND: 'refund' as const, // Refund (quantity > 0) (退款（数量 > 0）)
    ADJUSTMENT: 'adjustment' as const, // Manual adjustment (quantity can be positive or negative) (手动调整（数量可正可负）)
  };

  static CONSUMPTION = new LedgerType(this.TYPES.CONSUMPTION);
  static REFUND = new LedgerType(this.TYPES.REFUND);
  static ADJUSTMENT = new LedgerType(this.TYPES.ADJUSTMENT);

  private constructor(private readonly value: LedgerTypeValue) {}

  /**
   * Create a LedgerType from string (从字符串创建LedgerType)
   *
   * @param value - Type value string (类型值字符串)
   * @returns LedgerType instance (LedgerType实例)
   * @throws InvalidLedgerTypeException if value is invalid (值无效时抛出InvalidLedgerTypeException)
   */
  static fromString(value: string): LedgerType {
    const normalizedValue = value.toLowerCase();
    switch (normalizedValue) {
      case this.TYPES.CONSUMPTION:
        return this.CONSUMPTION;
      case this.TYPES.REFUND:
        return this.REFUND;
      case this.TYPES.ADJUSTMENT:
        return this.ADJUSTMENT;
      default:
        throw new InvalidLedgerTypeException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Type value string (类型值字符串)
   * @returns LedgerType instance (LedgerType实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): LedgerType {
    return new LedgerType(value as LedgerTypeValue);
  }

  /**
   * Check if this is a consumption type (检查是否为消费类型)
   *
   * @returns true if consumption type (是消费类型时返回true)
   */
  isConsumption(): boolean {
    return this.value === LedgerType.TYPES.CONSUMPTION;
  }

  /**
   * Check if this is a refund type (检查是否为退款类型)
   *
   * @returns true if refund type (是退款类型时返回true)
   */
  isRefund(): boolean {
    return this.value === LedgerType.TYPES.REFUND;
  }

  /**
   * Check if this is an adjustment type (检查是否为调整类型)
   *
   * @returns true if adjustment type (是调整类型时返回true)
   */
  isAdjustment(): boolean {
    return this.value === LedgerType.TYPES.ADJUSTMENT;
  }

  /**
   * Get the type value (获取类型值)
   *
   * @returns Type value string (类型值字符串)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check equality with another LedgerType (检查与另一个LedgerType是否相等)
   *
   * @param other - LedgerType to compare (要比较的LedgerType)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: LedgerType): boolean {
    return this.value === other.value;
  }
}

/**
 * InvalidLedgerTypeException (无效台账类型异常)
 */
export class InvalidLedgerTypeException extends DomainException {
  constructor(value: string) {
    super(
      'INVALID_LEDGER_TYPE',
      `Invalid ledger type: ${value}. Must be 'consumption', 'refund', or 'adjustment'`,
      { value },
    );
  }
}
