/**
 * Money Value Object (金额值对象)
 * Represents a monetary amount with currency (表示带有货币的金额)
 */

import { DomainException } from '@core/exceptions/domain.exception';

export class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {}

  /**
   * Create a new Money instance (创建新的Money实例)
   *
   * @param amount - Monetary amount (金额)
   * @param currency - Currency code (ISO 4217) (货币代码)
   * @returns Money instance (Money实例)
   * @throws InvalidMoneyException if amount or currency is invalid (金额或货币无效时抛出异常)
   */
  static create(amount: number, currency: string): Money {
    if (amount < 0) {
      throw new InvalidMoneyAmountException('Amount cannot be negative');
    }

    if (!currency || currency.length !== 3) {
      throw new InvalidCurrencyException(currency);
    }

    return new Money(amount, currency.toUpperCase());
  }

  /**
   * Reconstruct a Money from persistence data (从持久化数据重建Money)
   *
   * @param amount - Monetary amount (金额)
   * @param currency - Currency code (货币代码)
   * @returns Money instance (Money实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(amount: number, currency: string): Money {
    return new Money(amount, currency);
  }

  /**
   * Add money with same currency (同币种金额相加)
   *
   * @param other - Money to add (要加的金额)
   * @returns New Money instance with sum (新的Money实例)
   * @throws CurrencyMismatchException if currencies don't match (货币不匹配时抛出异常)
   */
  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchException(this.currency, other.currency);
    }

    return new Money(this.amount + other.amount, this.currency);
  }

  /**
   * Subtract money with same currency (同币种金额相减)
   *
   * @param other - Money to subtract (要减的金额)
   * @returns New Money instance with difference (新的Money实例)
   * @throws CurrencyMismatchException if currencies don't match (货币不匹配时抛出异常)
   * @throws InvalidMoneyAmountException if result would be negative (结果为负时抛出异常)
   */
  subtract(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchException(this.currency, other.currency);
    }

    const result = this.amount - other.amount;
    if (result < 0) {
      throw new InvalidMoneyAmountException('Result cannot be negative');
    }

    return new Money(result, this.currency);
  }

  /**
   * Multiply money by a factor (金额乘以系数)
   *
   * @param factor - Multiplication factor (乘数)
   * @returns New Money instance with multiplied amount (新的Money实例)
   */
  multiply(factor: number): Money {
    if (factor < 0) {
      throw new InvalidMoneyAmountException('Factor cannot be negative');
    }

    return new Money(this.amount * factor, this.currency);
  }

  /**
   * Check if this money is zero (检查是否为零)
   *
   * @returns true if amount is zero (金额为零时返回true)
   */
  isZero(): boolean {
    return this.amount === 0;
  }

  /**
   * Check if this money is greater than another (比较是否大于)
   *
   * @param other - Money to compare (要比较的金额)
   * @returns true if this amount is greater (此金额更大时返回true)
   * @throws CurrencyMismatchException if currencies don't match (货币不匹配时抛出异常)
   */
  isGreaterThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchException(this.currency, other.currency);
    }

    return this.amount > other.amount;
  }

  /**
   * Check if this money is less than another (比较是否小于)
   *
   * @param other - Money to compare (要比较的金额)
   * @returns true if this amount is less (此金额更小时返回true)
   * @throws CurrencyMismatchException if currencies don't match (货币不匹配时抛出异常)
   */
  isLessThan(other: Money): boolean {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchException(this.currency, other.currency);
    }

    return this.amount < other.amount;
  }

  /**
   * Format money as string (格式化金额字符串)
   *
   * @returns Formatted money string (格式化的金额字符串)
   */
  format(): string {
    return `${this.currency} ${this.amount.toFixed(2)}`;
  }

  // Getters
  getAmount(): number {
    return this.amount;
  }

  getCurrency(): string {
    return this.currency;
  }
}

/**
 * InvalidMoneyAmountException (无效金额异常)
 */
export class InvalidMoneyAmountException extends DomainException {
  constructor(message: string) {
    super(
      'INVALID_MONEY_AMOUNT',
      message,
      { message },
    );
  }
}

/**
 * InvalidCurrencyException (无效货币异常)
 */
export class InvalidCurrencyException extends DomainException {
  constructor(currency: string) {
    super(
      'INVALID_CURRENCY',
      `Invalid currency code: ${currency}. Must be 3-letter ISO 4217 code.`,
      { currency },
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
      `Currency mismatch: ${currency1} vs ${currency2}`,
      { currency1, currency2 },
    );
  }
}
