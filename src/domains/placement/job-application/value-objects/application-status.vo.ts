/**
 * ApplicationStatus Value Object (投递状态值对象)
 * State machine for job application lifecycle management (投递申请生命周期管理状态机)
 */

import { DomainException } from '@core/exceptions/domain.exception';
import {
  APPLICATION_STATUSES,
  ApplicationStatus as ApplicationStatusType,
  ALLOWED_APPLICATION_STATUS_TRANSITIONS,
} from '@domains/placement/types/application-status.types';

export class ApplicationStatus {
  private static readonly STATUSES = {
    RECOMMENDED: 'recommended' as const, // Recommended to student (已推荐给学生)
    INTERESTED: 'interested' as const, // Student is interested (学生感兴趣)
    NOT_INTERESTED: 'not_interested' as const, // Student is not interested (学生不感兴趣)
    REVOKED: 'revoked' as const, // Recommendation revoked (推荐已撤回)
    MENTOR_ASSIGNED: 'mentor_assigned' as const, // Assigned to mentor for referral (已分配给导师内推)
    SUBMITTED: 'submitted' as const, // Application submitted (申请已提交)
    INTERVIEWED: 'interviewed' as const, // Interview completed (面试完成)
    GOT_OFFER: 'got_offer' as const, // Offer received (收到Offer)
    REJECTED: 'rejected' as const, // Application rejected (申请被拒绝)
  };

  static RECOMMENDED = new ApplicationStatus(this.STATUSES.RECOMMENDED);
  static INTERESTED = new ApplicationStatus(this.STATUSES.INTERESTED);
  static NOT_INTERESTED = new ApplicationStatus(this.STATUSES.NOT_INTERESTED);
  static REVOKED = new ApplicationStatus(this.STATUSES.REVOKED);
  static MENTOR_ASSIGNED = new ApplicationStatus(this.STATUSES.MENTOR_ASSIGNED);
  static SUBMITTED = new ApplicationStatus(this.STATUSES.SUBMITTED);
  static INTERVIEWED = new ApplicationStatus(this.STATUSES.INTERVIEWED);
  static GOT_OFFER = new ApplicationStatus(this.STATUSES.GOT_OFFER);
  static REJECTED = new ApplicationStatus(this.STATUSES.REJECTED);

  private static readonly transitions: Map<string, string[]> = (() => {
    const map = new Map<string, string[]>();

    // Build transitions from ALLOWED_APPLICATION_STATUS_TRANSITIONS
    Object.entries(ALLOWED_APPLICATION_STATUS_TRANSITIONS).forEach(
      ([from, tos]) => {
        map.set(from, tos || []);
      },
    );

    // Add transitions for states not in the allowed transitions (they're final states)
    Object.values(ApplicationStatus.STATUSES).forEach((status) => {
      if (!map.has(status)) {
        map.set(status, []);
      }
    });

    return map;
  })();

  private constructor(private readonly value: ApplicationStatusType) {}

  /**
   * Factory method to create an ApplicationStatus (创建ApplicationStatus的工厂方法)
   *
   * @param value - Status value string (状态值字符串)
   * @returns ApplicationStatus instance (ApplicationStatus实例)
   * @throws InvalidApplicationStatusException if value is invalid (值无效时抛出InvalidApplicationStatusException)
   */
  static fromString(value: string): ApplicationStatus {
    const normalizedValue = value.toLowerCase();
    const status = APPLICATION_STATUSES.find((s) => s === normalizedValue);

    if (!status) {
      throw new InvalidApplicationStatusException(value);
    }

    switch (status) {
      case this.STATUSES.RECOMMENDED:
        return this.RECOMMENDED;
      case this.STATUSES.INTERESTED:
        return this.INTERESTED;
      case this.STATUSES.NOT_INTERESTED:
        return this.NOT_INTERESTED;
      case this.STATUSES.REVOKED:
        return this.REVOKED;
      case this.STATUSES.MENTOR_ASSIGNED:
        return this.MENTOR_ASSIGNED;
      case this.STATUSES.SUBMITTED:
        return this.SUBMITTED;
      case this.STATUSES.INTERVIEWED:
        return this.INTERVIEWED;
      case this.STATUSES.GOT_OFFER:
        return this.GOT_OFFER;
      case this.STATUSES.REJECTED:
        return this.REJECTED;
      default:
        throw new InvalidApplicationStatusException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Status value string (状态值字符串)
   * @returns ApplicationStatus instance (ApplicationStatus实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): ApplicationStatus {
    return new ApplicationStatus(value as ApplicationStatusType);
  }

  /**
   * Check if can transition to target status (检查是否可以转换到目标状态)
   *
   * @param targetStatus - Target status value (目标状态值)
   * @returns true if transition is valid (转换有效时返回true)
   */
  canTransitionTo(targetStatus: string): boolean {
    const validTargets = ApplicationStatus.transitions.get(this.value) || [];
    return validTargets.includes(targetStatus);
  }

  /**
   * Check if current status is RECOMMENDED (检查当前状态是否为RECOMMENDED)
   *
   * @returns true if status is RECOMMENDED (状态为RECOMMENDED时返回true)
   */
  isRecommended(): boolean {
    return this.value === ApplicationStatus.STATUSES.RECOMMENDED;
  }

  /**
   * Check if current status is INTERESTED (检查当前状态是否为INTERESTED)
   *
   * @returns true if status is INTERESTED (状态为INTERESTED时返回true)
   */
  isInterested(): boolean {
    return this.value === ApplicationStatus.STATUSES.INTERESTED;
  }

  /**
   * Check if current status is NOT_INTERESTED (检查当前状态是否为NOT_INTERESTED)
   *
   * @returns true if status is NOT_INTERESTED (状态为NOT_INTERESTED时返回true)
   */
  isNotInterested(): boolean {
    return this.value === ApplicationStatus.STATUSES.NOT_INTERESTED;
  }

  /**
   * Check if current status is REVOKED (检查当前状态是否为REVOKED)
   *
   * @returns true if status is REVOKED (状态为REVOKED时返回true)
   */
  isRevoked(): boolean {
    return this.value === ApplicationStatus.STATUSES.REVOKED;
  }

  /**
   * Check if current status is MENTOR_ASSIGNED (检查当前状态是否为MENTOR_ASSIGNED)
   *
   * @returns true if status is MENTOR_ASSIGNED (状态为MENTOR_ASSIGNED时返回true)
   */
  isMentorAssigned(): boolean {
    return this.value === ApplicationStatus.STATUSES.MENTOR_ASSIGNED;
  }

  /**
   * Check if current status is SUBMITTED (检查当前状态是否为SUBMITTED)
   *
   * @returns true if status is SUBMITTED (状态为SUBMITTED时返回true)
   */
  isSubmitted(): boolean {
    return this.value === ApplicationStatus.STATUSES.SUBMITTED;
  }

  /**
   * Check if current status is INTERVIEWED (检查当前状态是否为INTERVIEWED)
   *
   * @returns true if status is INTERVIEWED (状态为INTERVIEWED时返回true)
   */
  isInterviewed(): boolean {
    return this.value === ApplicationStatus.STATUSES.INTERVIEWED;
  }

  /**
   * Check if current status is GOT_OFFER (检查当前状态是否为GOT_OFFER)
   *
   * @returns true if status is GOT_OFFER (状态为GOT_OFFER时返回true)
   */
  isGotOffer(): boolean {
    return this.value === ApplicationStatus.STATUSES.GOT_OFFER;
  }

  /**
   * Check if current status is REJECTED (检查当前状态是否为REJECTED)
   *
   * @returns true if status is REJECTED (状态为REJECTED时返回true)
   */
  isRejected(): boolean {
    return this.value === ApplicationStatus.STATUSES.REJECTED;
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
   * Check equality with another ApplicationStatus (检查与另一个ApplicationStatus是否相等)
   *
   * @param other - ApplicationStatus to compare (要比较的ApplicationStatus)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: ApplicationStatus): boolean {
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
 * InvalidApplicationStatusException (无效投递状态异常)
 */
export class InvalidApplicationStatusException extends DomainException {
  constructor(status: string) {
    super(
      'INVALID_APPLICATION_STATUS',
      `Invalid application status: ${status}`,
      { status },
    );
  }
}
