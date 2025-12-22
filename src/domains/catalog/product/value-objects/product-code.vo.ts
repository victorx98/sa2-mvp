import { DomainException } from '@core/exceptions/domain.exception';

/**
 * ProductCode Value Object (产品编码值对象)
 * Encapsulates product code validation and formatting (封装产品编码的验证和格式化)
 */
export class ProductCode {
  private constructor(private readonly value: string) {}

  /**
   * Factory method to create a ProductCode (创建ProductCode的工厂方法)
   *
   * @param code - Product code string (产品编码字符串)
   * @returns ProductCode instance (ProductCode实例)
   * @throws InvalidProductCodeException if format is invalid (格式无效时抛出InvalidProductCodeException)
   */
  static create(code: string): ProductCode {
    if (!this.isValid(code)) {
      throw new InvalidProductCodeException(code);
    }

    return new ProductCode(code.toUpperCase());
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param code - Product code string (产品编码字符串)
   * @returns ProductCode instance (ProductCode实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(code: string): ProductCode {
    return new ProductCode(code);
  }

  /**
   * Validate product code format (验证产品编码格式)
   *
   * Rules:
   * - 3-20 characters (3-20个字符)
   * - Alphanumeric and hyphens only (只允许字母数字和连字符)
   * - Must start with letter (必须以字母开头)
   * - Cannot end with hyphen (不能以连字符结尾)
   * - No consecutive hyphens (不能有连续的连字符)
   *
   * Examples:
   * - ✓ PROD-001
   * - ✓ BASIC-PLAN
   * - ✗ 123PROD (doesn't start with letter) (不以字母开头)
   * - ✗ PROD--001 (consecutive hyphens) (有连续连字符)
   * - ✗ PROD- (ends with hyphen) (以连字符结尾)
   *
   * @param code - Code to validate (要验证的编码)
   * @returns true if valid (有效时返回true)
   */
  private static isValid(code: string): boolean {
    if (!code || code.length < 3 || code.length > 20) {
      return false;
    }

    // Must start with letter (必须以字母开头)
    if (!/^[A-Za-z]/.test(code)) {
      return false;
    }

    // Cannot end with hyphen (不能以连字符结尾)
    if (code.endsWith('-')) {
      return false;
    }

    // Check for consecutive hyphens (检查是否有连续连字符)
    if (code.includes('--')) {
      return false;
    }

    // Only alphanumeric and hyphens (只允许字母数字和连字符)
    if (!/^[A-Za-z0-9\-]+$/.test(code)) {
      return false;
    }

    return true;
  }

  /**
   * Get the code value (获取编码值)
   *
   * @returns Product code string (产品编码字符串)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check equality with another ProductCode (检查与另一个ProductCode是否相等)
   *
   * @param other - ProductCode to compare (要比较的ProductCode)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: ProductCode): boolean {
    return this.value === other.value;
  }

  /**
   * Get string representation (获取字符串表示)
   *
   * @returns Code value (编码值)
   */
  toString(): string {
    return this.value;
  }
}

/**
 * InvalidProductCodeException (无效产品编码异常)
 * Thrown when product code format is invalid (产品编码格式无效时抛出)
 */
export class InvalidProductCodeException extends DomainException {
  constructor(code: string) {
    super(
      'INVALID_PRODUCT_CODE',
      `Invalid product code format: ${code}. Code must be 3-20 characters, start with a letter, and contain only alphanumeric characters and hyphens`,
      { code },
    );
  }
}
