/**
 * H1BStatus Value Object (H1B签证状态值对象)
 * Represents H1B visa support status for a job position (表示岗位的H1B签证支持状态)
 */

import { DomainException } from '@core/exceptions/domain.exception';
import { H1BStatus } from '@domains/placement/types/h1b-status.enum';

export class H1BStatusVO {
  private static readonly STATUSES = {
    YES: H1BStatus.YES, // H1B visa is supported (支持H1B签证)
    MAYBE: H1BStatus.MAYBE, // H1B visa support is uncertain (H1B签证支持不确定)
    NO: H1BStatus.NO, // H1B visa is not supported (不支持H1B签证)
  };

  static YES = new H1BStatusVO(this.STATUSES.YES);
  static MAYBE = new H1BStatusVO(this.STATUSES.MAYBE);
  static NO = new H1BStatusVO(this.STATUSES.NO);

  private constructor(private readonly value: H1BStatus) {}

  /**
   * Factory method to create an H1BStatus (创建H1BStatus的工厂方法)
   *
   * @param value - Status value string (状态值字符串)
   * @returns H1BStatusVO instance (H1BStatusVO实例)
   * @throws InvalidH1BStatusException if value is invalid (值无效时抛出InvalidH1BStatusException)
   */
  static fromString(value: string): H1BStatusVO {
    const normalizedValue = value.toLowerCase();

    if (!(Object.values(this.STATUSES) as string[]).includes(normalizedValue)) {
      throw new InvalidH1BStatusException(value);
    }

    switch (normalizedValue) {
      case this.STATUSES.YES:
        return this.YES;
      case this.STATUSES.MAYBE:
        return this.MAYBE;
      case this.STATUSES.NO:
        return this.NO;
      default:
        throw new InvalidH1BStatusException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Status value string (状态值字符串)
   * @returns H1BStatusVO instance (H1BStatusVO实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): H1BStatusVO {
    return new H1BStatusVO(value as H1BStatus);
  }

  /**
   * Check if H1B is supported (检查是否支持H1B)
   *
   * @returns true if supported (支持时返回true)
   */
  isSupported(): boolean {
    return this.value === H1BStatusVO.STATUSES.YES;
  }

  /**
   * Check if H1B support is uncertain (检查H1B支持是否不确定)
   *
   * @returns true if uncertain (不确定时返回true)
   */
  isUncertain(): boolean {
    return this.value === H1BStatusVO.STATUSES.MAYBE;
  }

  /**
   * Check if H1B is not supported (检查是否不支持H1B)
   *
   * @returns true if not supported (不支持时返回true)
   */
  isNotSupported(): boolean {
    return this.value === H1BStatusVO.STATUSES.NO;
  }

  /**
   * Get the status value (获取状态值)
   *
   * @returns Status value string (状态值字符串)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check equality with another H1BStatusVO (检查与另一个H1BStatusVO是否相等)
   *
   * @param other - H1BStatusVO to compare (要比较的H1BStatusVO)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: H1BStatusVO): boolean {
    return this.value === other.value;
  }
}

/**
 * InvalidH1BStatusException (无效H1B状态异常)
 */
export class InvalidH1BStatusException extends DomainException {
  constructor(status: string) {
    super(
      'INVALID_H1B_STATUS',
      `Invalid H1B status: ${status}. Must be 'yes', 'maybe', or 'no'`,
      { status },
    );
  }
}
