/**
 * JobType Value Object (职位类型值对象)
 * Represents the type of job position (表示职位类型)
 */

import { DomainException } from '@core/exceptions/domain.exception';
import { JobType } from '@domains/placement/types/job-type.enum';

export class JobTypeVO {
  private static readonly TYPES = {
    FULL_TIME: JobType.FULL_TIME, // Full-time position (全职岗位)
    INTERNSHIP: JobType.INTERNSHIP, // Internship position (实习岗位)
    BOTH: JobType.BOTH, // Both full-time and internship (全职和实习)
  };

  static FULL_TIME = new JobTypeVO(this.TYPES.FULL_TIME);
  static INTERNSHIP = new JobTypeVO(this.TYPES.INTERNSHIP);
  static BOTH = new JobTypeVO(this.TYPES.BOTH);

  private constructor(private readonly value: JobType) {}

  /**
   * Factory method to create a JobTypeVO (创建JobTypeVO的工厂方法)
   *
   * @param value - Type value string (类型值字符串)
   * @returns JobTypeVO instance (JobTypeVO实例)
   * @throws InvalidJobTypeException if value is invalid (值无效时抛出InvalidJobTypeException)
   */
  static fromString(value: string): JobTypeVO {
    const normalizedValue = value.toLowerCase();

    if (!(Object.values(this.TYPES) as string[]).includes(normalizedValue)) {
      throw new InvalidJobTypeException(value);
    }

    switch (normalizedValue) {
      case this.TYPES.FULL_TIME:
        return this.FULL_TIME;
      case this.TYPES.INTERNSHIP:
        return this.INTERNSHIP;
      case this.TYPES.BOTH:
        return this.BOTH;
      default:
        throw new InvalidJobTypeException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Type value string (类型值字符串)
   * @returns JobTypeVO instance (JobTypeVO实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): JobTypeVO {
    return new JobTypeVO(value as JobType);
  }

  /**
   * Check if this is a full-time position (检查是否为全职岗位)
   *
   * @returns true if full-time (是全职时返回true)
   */
  isFullTime(): boolean {
    return this.value === JobTypeVO.TYPES.FULL_TIME;
  }

  /**
   * Check if this is an internship position (检查是否为实习岗位)
   *
   * @returns true if internship (是实习时返回true)
   */
  isInternship(): boolean {
    return this.value === JobTypeVO.TYPES.INTERNSHIP;
  }

  /**
   * Check if this supports both full-time and internship (检查是否同时支持全职和实习)
   *
   * @returns true if supports both (同时支持时返回true)
   */
  isBoth(): boolean {
    return this.value === JobTypeVO.TYPES.BOTH;
  }

  /**
   * Check if this position type matches the student's preference (检查职位类型是否匹配学生偏好)
   *
   * @param preference - Student's job type preference (学生职位类型偏好)
   * @returns true if matches (匹配时返回true)
   */
  matchesPreference(preference: string): boolean {
    return this.value === preference || this.isBoth();
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
   * Check equality with another JobTypeVO (检查与另一个JobTypeVO是否相等)
   *
   * @param other - JobTypeVO to compare (要比较的JobTypeVO)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: JobTypeVO): boolean {
    return this.value === other.value;
  }
}

/**
 * InvalidJobTypeException (无效职位类型异常)
 */
export class InvalidJobTypeException extends DomainException {
  constructor(value: string) {
    super(
      'INVALID_JOB_TYPE',
      `Invalid job type: ${value}. Must be 'Full-time', 'Internship', or 'Both'`,
      { value },
    );
  }
}
