/**
 * JobLevel Value Object (岗位级别值对象)
 * Represents the skill level requirement for a job position (表示岗位对技能等级的要求)
 */

import { DomainException } from '@core/exceptions/domain.exception';
import { JobLevel } from '@domains/placement/types/job-level.enum';

export class JobLevelVO {
  private static readonly LEVELS = {
    ENTRY_LEVEL: JobLevel.ENTRY_LEVEL, // Entry level position (初级岗位)
    MID_LEVEL: JobLevel.MID_LEVEL, // Mid-level position (中级岗位)
    SENIOR_LEVEL: JobLevel.SENIOR_LEVEL, // Senior level position (高级岗位)
  };

  static ENTRY_LEVEL = new JobLevelVO(this.LEVELS.ENTRY_LEVEL);
  static MID_LEVEL = new JobLevelVO(this.LEVELS.MID_LEVEL);
  static SENIOR_LEVEL = new JobLevelVO(this.LEVELS.SENIOR_LEVEL);

  private constructor(private readonly value: JobLevel) {}

  /**
   * Factory method to create a JobLevelVO (创建JobLevelVO的工厂方法)
   *
   * @param value - Level value string (级别值字符串)
   * @returns JobLevelVO instance (JobLevelVO实例)
   * @throws InvalidJobLevelException if value is invalid (值无效时抛出InvalidJobLevelException)
   */
  static fromString(value: string): JobLevelVO {
    const normalizedValue = value.toLowerCase();

    if (!(Object.values(this.LEVELS) as string[]).includes(normalizedValue)) {
      throw new InvalidJobLevelException(value);
    }

    switch (normalizedValue) {
      case this.LEVELS.ENTRY_LEVEL:
        return this.ENTRY_LEVEL;
      case this.LEVELS.MID_LEVEL:
        return this.MID_LEVEL;
      case this.LEVELS.SENIOR_LEVEL:
        return this.SENIOR_LEVEL;
      default:
        throw new InvalidJobLevelException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Level value string (级别值字符串)
   * @returns JobLevelVO instance (JobLevelVO实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): JobLevelVO {
    return new JobLevelVO(value as JobLevel);
  }

  /**
   * Check if this is an entry level position (检查是否为初级岗位)
   *
   * @returns true if entry level (是初级时返回true)
   */
  isEntryLevel(): boolean {
    return this.value === JobLevelVO.LEVELS.ENTRY_LEVEL;
  }

  /**
   * Check if this is a mid-level position (检查是否为中级岗位)
   *
   * @returns true if mid-level (是中级时返回true)
   */
  isMidLevel(): boolean {
    return this.value === JobLevelVO.LEVELS.MID_LEVEL;
  }

  /**
   * Check if this is a senior level position (检查是否为高级岗位)
   *
   * @returns true if senior level (是高级时返回true)
   */
  isSeniorLevel(): boolean {
    return this.value === JobLevelVO.LEVELS.SENIOR_LEVEL;
  }

  /**
   * Check if a candidate with the given experience level is eligible (检查具有给定经验水平的候选人是否符合资格)
   *
   * @param candidateLevel - Candidate's experience level (候选人的经验水平)
   * @returns true if eligible (符合资格时返回true)
   */
  isCandidateEligible(candidateLevel: string): boolean {
    if (this.isEntryLevel()) {
      return true; // Entry level accepts all candidates (初级岗位接受所有候选人)
    }
    if (this.isMidLevel()) {
      return candidateLevel === 'mid_level' || candidateLevel === 'senior_level'; // Mid-level accepts mid and senior (中级接受中级和高级)
    }
    if (this.isSeniorLevel()) {
      return candidateLevel === 'senior_level'; // Senior level only accepts senior (高级只接受高级)
    }
    return false;
  }

  /**
   * Get the level value (获取级别值)
   *
   * @returns Level value string (级别值字符串)
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check equality with another JobLevelVO (检查与另一个JobLevelVO是否相等)
   *
   * @param other - JobLevelVO to compare (要比较的JobLevelVO)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: JobLevelVO): boolean {
    return this.value === other.value;
  }
}

/**
 * InvalidJobLevelException (无效岗位级别异常)
 */
export class InvalidJobLevelException extends DomainException {
  constructor(value: string) {
    super(
      'INVALID_JOB_LEVEL',
      `Invalid job level: ${value}. Must be 'entry_level', 'mid_level', or 'senior_level'`,
      { value },
    );
  }
}
