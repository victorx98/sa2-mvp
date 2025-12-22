/**
 * ApplicationType Value Object (投递类型值对象)
 * Represents the type of job application (表示投递申请的类型)
 */

import { DomainException } from '@core/exceptions/domain.exception';
import { ApplicationType } from '@domains/placement/types/application-type.enum';

export class ApplicationTypeVO {
  private static readonly TYPES = {
    DIRECT: ApplicationType.DIRECT, // Direct application - student applies directly (直接投递 - 学生自主投递)
    PROXY: ApplicationType.PROXY, // Proxy application - counselor applies on behalf (顾问代投 - 顾问代为投递)
    REFERRAL: ApplicationType.REFERRAL, // Referral application - mentor refers internally (导师内推 - 导师内部推荐)
    BD: ApplicationType.BD, // BD recommendation - BD department recommends (BD推荐 - BD部门推荐)
  };

  static DIRECT = new ApplicationTypeVO(this.TYPES.DIRECT);
  static PROXY = new ApplicationTypeVO(this.TYPES.PROXY);
  static REFERRAL = new ApplicationTypeVO(this.TYPES.REFERRAL);
  static BD = new ApplicationTypeVO(this.TYPES.BD);

  private constructor(private readonly value: ApplicationType) {}

  /**
   * Factory method to create an ApplicationTypeVO (创建ApplicationTypeVO的工厂方法)
   *
   * @param value - Type value string (类型值字符串)
   * @returns ApplicationTypeVO instance (ApplicationTypeVO实例)
   * @throws InvalidApplicationTypeException if value is invalid (值无效时抛出InvalidApplicationTypeException)
   */
  static fromString(value: string): ApplicationTypeVO {
    const normalizedValue = value.toLowerCase();
    switch (normalizedValue) {
      case this.TYPES.DIRECT:
        return this.DIRECT;
      case this.TYPES.PROXY:
        return this.PROXY;
      case this.TYPES.REFERRAL:
        return this.REFERRAL;
      case this.TYPES.BD:
        return this.BD;
      default:
        throw new InvalidApplicationTypeException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Type value string (类型值字符串)
   * @returns ApplicationTypeVO instance (ApplicationTypeVO实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): ApplicationTypeVO {
    return new ApplicationTypeVO(value as ApplicationType);
  }

  /**
   * Check if this is a direct application (检查是否为直接投递)
   *
   * @returns true if direct application (是直接投递时返回true)
   */
  isDirect(): boolean {
    return this.value === ApplicationTypeVO.TYPES.DIRECT;
  }

  /**
   * Check if this is a proxy application (检查是否为顾问代投)
   *
   * @returns true if proxy application (是顾问代投时返回true)
   */
  isProxy(): boolean {
    return this.value === ApplicationTypeVO.TYPES.PROXY;
  }

  /**
   * Check if this is a referral application (检查是否为导师内推)
   *
   * @returns true if referral application (是导师内推时返回true)
   */
  isReferral(): boolean {
    return this.value === ApplicationTypeVO.TYPES.REFERRAL;
  }

  /**
   * Check if this is a BD recommendation (检查是否为BD推荐)
   *
   * @returns true if BD recommendation (是BD推荐时返回true)
   */
  isBD(): boolean {
    return this.value === ApplicationTypeVO.TYPES.BD;
  }

  /**
   * Check if this application requires mentor assignment (检查此申请是否需要分配导师)
   * Only referral applications require mentor assignment (只有内推申请需要分配导师)
   *
   * @returns true if requires mentor assignment (需要分配导师时返回true)
   */
  requiresMentor(): boolean {
    return this.isReferral();
  }

  /**
   * Check if this application requires service entitlement validation (检查此申请是否需要验证服务权益)
   * Only proxy and BD applications require service entitlement validation (只有顾问代投和BD推荐需要验证服务权益)
   *
   * @returns true if requires service entitlement validation (需要验证服务权益时返回true)
   */
  requiresServiceEntitlement(): boolean {
    return this.isProxy() || this.isBD();
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
   * Check equality with another ApplicationTypeVO (检查与另一个ApplicationTypeVO是否相等)
   *
   * @param other - ApplicationTypeVO to compare (要比较的ApplicationTypeVO)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: ApplicationTypeVO): boolean {
    return this.value === other.value;
  }

  /**
   * Get string representation (获取字符串表示)
   *
   * @returns Type value (类型值)
   */
  toString(): string {
    return this.value;
  }
}

/**
 * InvalidApplicationTypeException (无效投递类型异常)
 */
export class InvalidApplicationTypeException extends DomainException {
  constructor(value: string) {
    super(
      'INVALID_APPLICATION_TYPE',
      `Invalid application type: ${value}. Must be 'direct', 'proxy', 'referral', or 'bd'`,
      { value },
    );
  }
}
