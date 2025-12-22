/**
 * USCitizenshipRequirement Value Object (美国公民身份要求值对象)
 * Represents US citizenship requirement for a job position (表示岗位的美国公民身份要求)
 */

import { DomainException } from '@core/exceptions/domain.exception';
import { USCitizenshipRequirement } from '@domains/placement/types/us-citizenship-requirement.enum';

export class USCitizenshipRequirementVO {
  private static readonly REQUIREMENTS = {
    NO: USCitizenshipRequirement.NO, // US citizenship is not required (不要求美国公民身份)
    PREFERRED: USCitizenshipRequirement.PREFERRED, // US citizenship is preferred but not required (优先考虑美国公民身份，但不强制)
  };

  static NO = new USCitizenshipRequirementVO(this.REQUIREMENTS.NO);
  static PREFERRED = new USCitizenshipRequirementVO(this.REQUIREMENTS.PREFERRED);

  private constructor(private readonly value: USCitizenshipRequirement) {}

  /**
   * Factory method to create a USCitizenshipRequirementVO (创建USCitizenshipRequirementVO的工厂方法)
   *
   * @param value - Requirement value string (要求值字符串)
   * @returns USCitizenshipRequirementVO instance (USCitizenshipRequirementVO实例)
   * @throws InvalidUSCitizenshipRequirementException if value is invalid (值无效时抛出InvalidUSCitizenshipRequirementException)
   */
  static fromString(value: string): USCitizenshipRequirementVO {
    const normalizedValue = value.toLowerCase();

    if (!(Object.values(this.REQUIREMENTS) as string[]).includes(normalizedValue)) {
      throw new InvalidUSCitizenshipRequirementException(value);
    }

    switch (normalizedValue) {
      case this.REQUIREMENTS.NO:
        return this.NO;
      case this.REQUIREMENTS.PREFERRED:
        return this.PREFERRED;
      default:
        throw new InvalidUSCitizenshipRequirementException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Requirement value string (要求值字符串)
   * @returns USCitizenshipRequirementVO instance (USCitizenshipRequirementVO实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): USCitizenshipRequirementVO {
    return new USCitizenshipRequirementVO(value as USCitizenshipRequirement);
  }

  /**
   * Check if US citizenship is required (检查是否要求美国公民身份)
   *
   * @returns false if not required (不要求时返回false)
   */
  isRequired(): boolean {
    return false;
  }

  /**
   * Check if US citizenship is preferred (检查是否优先考虑美国公民身份)
   *
   * @returns true if preferred (优先考虑时返回true)
   */
  isPreferred(): boolean {
    return this.value === USCitizenshipRequirementVO.REQUIREMENTS.PREFERRED;
  }

  /**
   * Check if US citizenship is not required (检查是否不要求美国公民身份)
   *
   * @returns true if not required (不要求时返回true)
   */
  isNotRequired(): boolean {
    return this.value === USCitizenshipRequirementVO.REQUIREMENTS.NO;
  }

  /**
   * Check if a candidate with the given citizenship status is eligible (检查具有给定公民身份状态的候选人是否符合资格)
   *
   * @param isUSCitizen - Whether candidate is US citizen (候选人是否为美国公民)
   * @returns true if eligible (符合资格时返回true)
   */
  isCandidateEligible(isUSCitizen: boolean): boolean {
    if (this.isNotRequired()) {
      return true; // No requirement, everyone is eligible (无要求，所有人都符合资格)
    }
    return isUSCitizen; // Preferred but required for some cases (优先考虑，但在某些情况下需要)
  }

  /**
   * Get the requirement value (获取要求值)
   *
   * @returns Requirement value string (要求值字符串)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check equality with another USCitizenshipRequirementVO (检查与另一个USCitizenshipRequirementVO是否相等)
   *
   * @param other - USCitizenshipRequirementVO to compare (要比较的USCitizenshipRequirementVO)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: USCitizenshipRequirementVO): boolean {
    return this.value === other.value;
  }
}

/**
 * InvalidUSCitizenshipRequirementException (无效美国公民身份要求异常)
 */
export class InvalidUSCitizenshipRequirementException extends DomainException {
  constructor(value: string) {
    super(
      'INVALID_US_CITIZENSHIP_REQUIREMENT',
      `Invalid US citizenship requirement: ${value}. Must be 'no' or 'preferred'`,
      { value },
    );
  }
}
