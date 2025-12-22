import { DomainException } from '@core/exceptions/domain.exception';

/**
 * Currency enum (货币枚举)
 */
export enum Currency {
  CNY = 'CNY',
  USD = 'USD',
}

/**
 * Price Value Object (价格值对象)
 * Encapsulates monetary value with validation and arithmetic operations (封装货币金额，提供验证和算术运算)
 */
export class Price {
  private constructor(
    private readonly amount: string, // Amount as string to avoid floating-point precision issues (金额，使用字符串避免浮点数精度问题)
    private readonly currency: Currency, // Currency ISO code (货币ISO代码)
  ) {}

  /**
   * Factory method to create a Price (创建Price的工厂方法)
   *
   * @param amount - Monetary amount (货币金额)
   * @param currency - Currency code (货币代码)
   * @returns Price instance (Price实例)
   * @throws InvalidPriceException if amount is not positive (金额不为正时抛出InvalidPriceException)
   */
  static create(amount: number | string, currency: Currency): Price {
    const parsedAmount = this.parseAmount(amount);

    if (parsedAmount <= 0) {
      throw new InvalidPriceException(String(amount));
    }

    return new Price(parsedAmount.toFixed(2), currency);
  }

  /**
   * Parse amount from number or string (从number或string解析金额)
   */
  private static parseAmount(amount: number | string): number {
    const parsed = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (isNaN(parsed)) {
      throw new InvalidPriceException(String(amount));
    }

    return parsed;
  }

  /**
   * Add another Price to this Price (将另一个Price加到当前Price)
   *
   * @param other - Price to add (要添加的Price)
   * @returns New Price with the sum (返回包含总和的新Price)
   * @throws CurrencyMismatchException if currencies differ (货币不同时抛出CurrencyMismatchException)
   */
  add(other: Price): Price {
    this.ensureSameCurrency(other);

    const result = this.getNumericAmount() + other.getNumericAmount();
    return Price.create(result, this.currency);
  }

  /**
   * Subtract another Price from this Price (从当前Price减去另一个Price)
   *
   * @param other - Price to subtract (要减去的Price)
   * @returns New Price with the difference (返回包含差值的新Price)
   * @throws CurrencyMismatchException if currencies differ (货币不同时抛出CurrencyMismatchException)
   */
  subtract(other: Price): Price {
    this.ensureSameCurrency(other);

    const result = this.getNumericAmount() - other.getNumericAmount();
    return Price.create(result, this.currency);
  }

  /**
   * Multiply this Price by a factor (将当前Price乘以系数)
   *
   * @param factor - Multiplication factor (乘法系数)
   * @returns New Price multiplied by the factor (返回乘以系数后的新Price)
   */
  multiply(factor: number): Price {
    const result = this.getNumericAmount() * factor;
    return Price.create(result, this.currency);
  }

  /**
   * Check if this Price is greater than another Price (检查当前Price是否大于另一个Price)
   *
   * @param other - Price to compare (要比较的Price)
   * @returns true if this Price is greater (当前Price更大时返回true)
   */
  isGreaterThan(other: Price): boolean {
    this.ensureSameCurrency(other);
    return this.getNumericAmount() > other.getNumericAmount();
  }

  /**
   * Check if this Price is zero (检查当前Price是否为零)
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
   * Check equality with another Price (检查与另一个Price是否相等)
   *
   * @param other - Price to compare (要比较的Price)
   * @returns true if amounts and currencies are equal (金额和货币都相等时返回true)
   */
  equals(other: Price): boolean {
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
   * @param other - Price to compare (要比较的Price)
   * @throws CurrencyMismatchException if currencies differ (货币不同时抛出CurrencyMismatchException)
   */
  private ensureSameCurrency(other: Price): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchException(this.currency, other.currency);
    }
  }
}

/**
 * InvalidPriceException (无效价格异常)
 */
export class InvalidPriceException extends DomainException {
  constructor(amount: string) {
    super(
      'INVALID_PRICE',
      `Invalid price amount: ${amount}. Must be a positive number`,
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
