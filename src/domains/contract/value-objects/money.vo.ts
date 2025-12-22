import { DomainException } from '@core/exceptions/domain.exception';

/**
 * Currency enum for contracts (合同货币枚举)
 */
export enum Currency {
  CNY = 'CNY',
  USD = 'USD',
}

/**
 * Money Value Object (金额值对象)
 * Encapsulates monetary value with validation and arithmetic operations for contracts
 * (封装合同货币金额，提供验证和算术运算)
 */
export class Money {
  private constructor(
    private readonly amount: string, // Amount as string to avoid floating-point precision issues (金额，使用字符串避免浮点数精度问题)
    private readonly currency: Currency, // Currency ISO code (货币ISO代码)
  ) {}

  /**
   * Factory method to create Money (创建Money的工厂方法)
   *
   * @param amount - Monetary amount (货币金额)
   * @param currency - Currency code (货币代码)
   * @returns Money instance (Money实例)
   * @throws InvalidMoneyException if amount is not positive (金额不为正时抛出InvalidMoneyException)
   */
  static create(amount: number | string, currency: Currency): Money {
    const parsedAmount = this.parseAmount(amount);

    if (parsedAmount < 0) {
      throw new InvalidMoneyException(String(amount));
    }

    return new Money(parsedAmount.toFixed(2), currency);
  }

  /**
   * Factory method to create zero Money (创建零Money的工厂方法)
   *
   * @param currency - Currency code (货币代码)
   * @returns Money with zero amount (零金额的Money)
   */
  static zero(currency: Currency): Money {
    return new Money('0.00', currency);
  }

  /**
   * Parse amount from number or string (从number或string解析金额)
   */
  private static parseAmount(amount: number | string): number {
    const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (isNaN(parsed)) {
      throw new InvalidMoneyException(String(amount));
    }

    return parsed;
  }

  /**
   * Add another Money to this Money (将另一个Money加到当前Money)
   *
   * @param other - Money to add (要添加的Money)
   * @returns New Money with the sum (返回包含总和的新Money)
   * @throws CurrencyMismatchException if currencies differ (货币不同时抛出CurrencyMismatchException)
   */
  add(other: Money): Money {
    this.ensureSameCurrency(other);

    const result = this.getNumericAmount() + other.getNumericAmount();
    return Money.create(result, this.currency);
  }

  /**
   * Subtract another Money from this Money (从当前Money减去另一个Money)
   *
   * @param other - Money to subtract (要减去的Money)
   * @returns New Money with the difference (返回包含差值的新Money)
   * @throws CurrencyMismatchException if currencies differ (货币不同时抛出CurrencyMismatchException)
   * @throws InsufficientMoneyException if result is negative (结果为负数时抛出InsufficientMoneyException)
   */
  subtract(other: Money): Money {
    this.ensureSameCurrency(other);

    const result = this.getNumericAmount() - other.getNumericAmount();
    if (result < 0) {
      throw new InsufficientMoneyException(this, other);
    }

    return Money.create(result, this.currency);
  }

  /**
   * Multiply this Money by a factor (将当前Money乘以系数)
   *
   * @param factor - Multiplication factor (乘法系数)
   * @returns New Money multiplied by the factor (返回乘以系数后的新Money)
   */
  multiply(factor: number): Money {
    const result = this.getNumericAmount() * factor;
    return Money.create(result, this.currency);
  }

  /**
   * Check if this Money is greater than another Money (检查当前Money是否大于另一个Money)
   *
   * @param other - Money to compare (要比较的Money)
   * @returns true if this Money is greater (当前Money更大时返回true)
   */
  isGreaterThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.getNumericAmount() > other.getNumericAmount();
  }

  /**
   * Check if this Money is greater than or equal to another Money (检查当前Money是否大于或等于另一个Money)
   *
   * @param other - Money to compare (要比较的Money)
   * @returns true if this Money is greater or equal (当前Money大于或等于时返回true)
   */
  isGreaterThanOrEqual(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.getNumericAmount() >= other.getNumericAmount();
  }

  /**
   * Check if this Money is less than another Money (检查当前Money是否小于另一个Money)
   *
   * @param other - Money to compare (要比较的Money)
   * @returns true if this Money is less (当前Money更小时返回true)
   */
  isLessThan(other: Money): boolean {
    this.ensureSameCurrency(other);
    return this.getNumericAmount() < other.getNumericAmount();
  }

  /**
   * Check if this Money is zero (检查当前Money是否为零)
   *
   * @returns true if amount is zero (金额为零时返回true)
   */
  isZero(): boolean {
    return this.getNumericAmount() === 0;
  }

  /**
   * Get string representation (获取字符串表示)
   *
   * @returns Formatted string (格式化字符串)
   */
  toString(): string {
    return `${this.currency} ${this.amount}`;
  }

  /**
   * Check equality with another Money (检查与另一个Money是否相等)
   *
   * @param other - Money to compare (要比较的Money)
   * @returns true if amounts and currencies are equal (金额和货币都相等时返回true)
   */
  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  /**
   * Get numeric amount value (获取数字形式的金额值)
   *
   * @returns numeric amount (数字形式的金额)
   */
  getNumericAmount(): number {
    return parseFloat(this.amount);
  }

  /**
   * Get amount string (获取金额字符串)
   *
   * @returns amount as string (以string形式返回金额)
   */
  getAmount(): string {
    return this.amount;
  }

  /**
   * Get currency (获取货币)
   *
   * @returns Currency enum (货币枚举)
   */
  getCurrency(): Currency {
    return this.currency;
  }

  /**
   * Ensure currencies match (确保货币匹配)
   *
   * @param other - Money to compare (要比较的Money)
   * @throws CurrencyMismatchException if currencies differ (货币不同时抛出CurrencyMismatchException)
   */
  private ensureSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchException(this.currency, other.currency);
    }
  }
}

/**
 * InvalidMoneyException (无效金额异常)
 */
export class InvalidMoneyException extends DomainException {
  constructor(amount: string) {
    super(
      'INVALID_MONEY',
      `Invalid money amount: ${amount}. Must be a non-negative number`,
      { amount },
    );
  }
}

/**
 * CurrencyMismatchException (货币不匹配异常)
 */
export class CurrencyMismatchException extends DomainException {
  constructor(currency1: string, currency2: string) {
    super(
      'CURRENCY_MISMATCH',
      `Currency mismatch: ${currency1} and ${currency2}`,
      { currency1, currency2 },
    );
  }
}

/**
 * InsufficientMoneyException (金额不足异常)
 */
export class InsufficientMoneyException extends DomainException {
  constructor(current: Money, subtracted: Money) {
    super(
      'INSUFFICIENT_MONEY',
      `Insufficient money: ${current.toString()} - ${subtracted.toString()} would result in negative amount`,
      {
        current: current.toString(),
        subtracted: subtracted.toString(),
      },
    );
  }
}
