/**
 * JobStatus Value Object (岗位状态值对象)
 * State machine for job position lifecycle management (岗位生命周期管理状态机)
 */

import { DomainException } from '@core/exceptions/domain.exception';
import {
  JobStatus as JobStatusType,
  ALLOWED_JOB_STATUS_TRANSITIONS,
} from '@domains/placement/types/job-status.types';

export class JobStatusVO {
  private static readonly STATUSES = {
    ACTIVE: 'active' as const, // Job is active and visible (岗位活跃且可见)
    INACTIVE: 'inactive' as const, // Job is inactive/hidden (岗位不活跃/隐藏)
    EXPIRED: 'expired' as const, // Job has expired (岗位已过期)
  };

  static ACTIVE = new JobStatusVO(this.STATUSES.ACTIVE);
  static INACTIVE = new JobStatusVO(this.STATUSES.INACTIVE);
  static EXPIRED = new JobStatusVO(this.STATUSES.EXPIRED);

  private readonly transitions: Map<string, string[]> = (() => {
    const map = new Map<string, string[]>();
    Object.entries(ALLOWED_JOB_STATUS_TRANSITIONS).forEach(([from, tos]) => {
      map.set(from, tos);
    });
    return map;
  })();

  private constructor(private readonly value: JobStatusType) {}

  /**
   * Factory method to create a JobStatus (创建JobStatus的工厂方法)
   *
   * @param value - Status value string (状态值字符串)
   * @returns JobStatusVO instance (JobStatusVO实例)
   * @throws InvalidJobStatusException if value is invalid (值无效时抛出InvalidJobStatusException)
   */
  static fromString(value: string): JobStatusVO {
    const normalizedValue = value.toLowerCase();

    if (!(Object.values(this.STATUSES) as string[]).includes(normalizedValue)) {
      throw new InvalidJobStatusException(value);
    }

    switch (normalizedValue) {
      case this.STATUSES.ACTIVE:
        return this.ACTIVE;
      case this.STATUSES.INACTIVE:
        return this.INACTIVE;
      case this.STATUSES.EXPIRED:
        return this.EXPIRED;
      default:
        throw new InvalidJobStatusException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Status value string (状态值字符串)
   * @returns JobStatusVO instance (JobStatusVO实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): JobStatusVO {
    return new JobStatusVO(value as JobStatusType);
  }

  /**
   * Transition to ACTIVE status (转换到ACTIVE状态)
   * Valid transitions: INACTIVE → ACTIVE, EXPIRED → ACTIVE (有效转换：INACTIVE → ACTIVE, EXPIRED → ACTIVE)
   *
   * @returns ACTIVE status (ACTIVE状态)
   * @throws InvalidJobStatusTransitionException if transition is invalid (转换无效时抛出InvalidJobStatusTransitionException)
   */
  transitionToActive(): JobStatusVO {
    if (!this.canTransitionTo(JobStatusVO.STATUSES.ACTIVE)) {
      throw new InvalidJobStatusTransitionException(
        this.value,
        JobStatusVO.STATUSES.ACTIVE,
      );
    }
    return JobStatusVO.ACTIVE;
  }

  /**
   * Transition to INACTIVE status (转换到INACTIVE状态)
   * Valid transition: ACTIVE → INACTIVE (有效转换：ACTIVE → INACTIVE)
   *
   * @returns INACTIVE status (INACTIVE状态)
   * @throws InvalidJobStatusTransitionException if transition is invalid (转换无效时抛出InvalidJobStatusTransitionException)
   */
  transitionToInactive(): JobStatusVO {
    if (!this.canTransitionTo(JobStatusVO.STATUSES.INACTIVE)) {
      throw new InvalidJobStatusTransitionException(
        this.value,
        JobStatusVO.STATUSES.INACTIVE,
      );
    }
    return JobStatusVO.INACTIVE;
  }

  /**
   * Transition to EXPIRED status (转换到EXPIRED状态)
   * Valid transition: ACTIVE → EXPIRED (有效转换：ACTIVE → EXPIRED)
   *
   * @returns EXPIRED status (EXPIRED状态)
   * @throws InvalidJobStatusTransitionException if transition is invalid (转换无效时抛出InvalidJobStatusTransitionException)
   */
  transitionToExpired(): JobStatusVO {
    if (!this.canTransitionTo(JobStatusVO.STATUSES.EXPIRED)) {
      throw new InvalidJobStatusTransitionException(
        this.value,
        JobStatusVO.STATUSES.EXPIRED,
      );
    }
    return JobStatusVO.EXPIRED;
  }

  /**
   * Check if can transition to target status (检查是否可以转换到目标状态)
   *
   * @param targetStatus - Target status value (目标状态值)
   * @returns true if transition is valid (转换有效时返回true)
   */
  canTransitionTo(targetStatus: string): boolean {
    const validTargets = this.transitions.get(this.value) || [];
    return validTargets.includes(targetStatus);
  }

  /**
   * Check if current status is ACTIVE (检查当前状态是否为ACTIVE)
   *
   * @returns true if status is ACTIVE (状态为ACTIVE时返回true)
   */
  isActive(): boolean {
    return this.value === JobStatusVO.STATUSES.ACTIVE;
  }

  /**
   * Check if current status is INACTIVE (检查当前状态是否为INACTIVE)
   *
   * @returns true if status is INACTIVE (状态为INACTIVE时返回true)
   */
  isInactive(): boolean {
    return this.value === JobStatusVO.STATUSES.INACTIVE;
  }

  /**
   * Check if current status is EXPIRED (检查当前状态是否为EXPIRED)
   *
   * @returns true if status is EXPIRED (状态为EXPIRED时返回true)
   */
  isExpired(): boolean {
    return this.value === JobStatusVO.STATUSES.EXPIRED;
  }

  /**
   * Check if job is visible to students (检查岗位是否对学生可见)
   * Only ACTIVE jobs are visible (只有ACTIVE岗位可见)
   *
   * @returns true if visible (可见时返回true)
   */
  isVisibleToStudents(): boolean {
    return this.isActive();
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
   * Check equality with another JobStatusVO (检查与另一个JobStatusVO是否相等)
   *
   * @param other - JobStatusVO to compare (要比较的JobStatusVO)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: JobStatusVO): boolean {
    return this.value === other.value;
  }

  /**
   * Get string representation (获取字符串表示)
   *
   * @returns Status value (状态值)
   */
  toString(): string {
    return this.value;
  }
}

/**
 * InvalidJobStatusException (无效岗位状态异常)
 */
export class InvalidJobStatusException extends DomainException {
  constructor(status: string) {
    super(
      'INVALID_JOB_STATUS',
      `Invalid job status: ${status}. Must be 'active', 'inactive', or 'expired'`,
      { status },
    );
  }
}

/**
 * InvalidJobStatusTransitionException (无效岗位状态转换异常)
 */
export class InvalidJobStatusTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(
      'INVALID_JOB_STATUS_TRANSITION',
      `Invalid job status transition from ${from} to ${to}`,
      { from, to },
    );
  }
}
