/**
 * HoldStatus Value Object (预留状态值对象)
 * State machine for service hold lifecycle management (服务预留生命周期管理状态机)
 */

import { DomainException } from '@core/exceptions/domain.exception';

// Valid hold status values (有效的预留状态值)
type HoldStatusValue = 'active' | 'released' | 'cancelled' | 'expired';

export class HoldStatus {
  private static readonly STATUSES = {
    ACTIVE: 'active' as const, // Hold is active and reserving services (预留处于活动状态，正在预留服务)
    RELEASED: 'released' as const, // Hold has been released (预留已释放)
    CANCELLED: 'cancelled' as const, // Hold has been cancelled (预留已取消)
    EXPIRED: 'expired' as const, // Hold has expired (预留已过期)
  };

  static ACTIVE = new HoldStatus(this.STATUSES.ACTIVE);
  static RELEASED = new HoldStatus(this.STATUSES.RELEASED);
  static CANCELLED = new HoldStatus(this.STATUSES.CANCELLED);
  static EXPIRED = new HoldStatus(this.STATUSES.EXPIRED);

  private readonly transitions: Map<string, string[]> = new Map([
    // From ACTIVE: can be released, cancelled, or expired (从ACTIVE：可以被释放、取消或过期)
    [HoldStatus.STATUSES.ACTIVE, [
      HoldStatus.STATUSES.RELEASED,
      HoldStatus.STATUSES.CANCELLED,
      HoldStatus.STATUSES.EXPIRED,
    ]],

    // From RELEASED: no transitions (final state) (从RELEASED：无转换（最终状态）)
    [HoldStatus.STATUSES.RELEASED, []],

    // From CANCELLED: no transitions (final state) (从CANCELLED：无转换（最终状态）)
    [HoldStatus.STATUSES.CANCELLED, []],

    // From EXPIRED: no transitions (final state) (从EXPIRED：无转换（最终状态）)
    [HoldStatus.STATUSES.EXPIRED, []],
  ]);

  private constructor(private readonly value: HoldStatusValue) {}

  /**
   * Factory method to create a HoldStatus (创建HoldStatus的工厂方法)
   *
   * @param value - Status value string (状态值字符串)
   * @returns HoldStatus instance (HoldStatus实例)
   * @throws InvalidHoldStatusException if value is invalid (值无效时抛出InvalidHoldStatusException)
   */
  static fromString(value: string): HoldStatus {
    switch (value.toLowerCase()) {
      case this.STATUSES.ACTIVE:
        return this.ACTIVE;
      case this.STATUSES.RELEASED:
        return this.RELEASED;
      case this.STATUSES.CANCELLED:
        return this.CANCELLED;
      case this.STATUSES.EXPIRED:
        return this.EXPIRED;
      default:
        throw new InvalidHoldStatusException(value);
    }
  }

  /**
   * Private factory method for reconstruction (私有工厂方法，用于重建)
   *
   * @param value - Status value string (状态值字符串)
   * @returns HoldStatus instance (HoldStatus实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(value: string): HoldStatus {
    return new HoldStatus(value as HoldStatusValue);
  }

  /**
   * Transition to RELEASED status (转换到RELEASED状态)
   *
   * @returns RELEASED status (RELEASED状态)
   * @throws InvalidHoldStatusTransitionException if transition is invalid (转换无效时抛出InvalidHoldStatusTransitionException)
   */
  transitionToReleased(): HoldStatus {
    if (!this.canTransitionTo(HoldStatus.STATUSES.RELEASED)) {
      throw new InvalidHoldStatusTransitionException(
        this.value,
        HoldStatus.STATUSES.RELEASED,
      );
    }
    return HoldStatus.RELEASED;
  }

  /**
   * Transition to CANCELLED status (转换到CANCELLED状态)
   *
   * @returns CANCELLED status (CANCELLED状态)
   * @throws InvalidHoldStatusTransitionException if transition is invalid (转换无效时抛出InvalidHoldStatusTransitionException)
   */
  transitionToCancelled(): HoldStatus {
    if (!this.canTransitionTo(HoldStatus.STATUSES.CANCELLED)) {
      throw new InvalidHoldStatusTransitionException(
        this.value,
        HoldStatus.STATUSES.CANCELLED,
      );
    }
    return HoldStatus.CANCELLED;
  }

  /**
   * Transition to EXPIRED status (转换到EXPIRED状态)
   *
   * @returns EXPIRED status (EXPIRED状态)
   * @throws InvalidHoldStatusTransitionException if transition is invalid (转换无效时抛出InvalidHoldStatusTransitionException)
   */
  transitionToExpired(): HoldStatus {
    if (!this.canTransitionTo(HoldStatus.STATUSES.EXPIRED)) {
      throw new InvalidHoldStatusTransitionException(
        this.value,
        HoldStatus.STATUSES.EXPIRED,
      );
    }
    return HoldStatus.EXPIRED;
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
    return this.value === HoldStatus.STATUSES.ACTIVE;
  }

  /**
   * Check if current status is RELEASED (检查当前状态是否为RELEASED)
   *
   * @returns true if status is RELEASED (状态为RELEASED时返回true)
   */
  isReleased(): boolean {
    return this.value === HoldStatus.STATUSES.RELEASED;
  }

  /**
   * Check if current status is CANCELLED (检查当前状态是否为CANCELLED)
   *
   * @returns true if status is CANCELLED (状态为CANCELLED时返回true)
   */
  isCancelled(): boolean {
    return this.value === HoldStatus.STATUSES.CANCELLED;
  }

  /**
   * Check if current status is EXPIRED (检查当前状态是否为EXPIRED)
   *
   * @returns true if status is EXPIRED (状态为EXPIRED时返回true)
   */
  isExpired(): boolean {
    return this.value === HoldStatus.STATUSES.EXPIRED;
  }

  /**
   * Check if hold can be released (检查预留是否可以释放)
   * Only ACTIVE holds can be released (只有ACTIVE预留可以释放)
   *
   * @returns true if can be released (可以释放时返回true)
   */
  canBeReleased(): boolean {
    return this.isActive();
  }

  /**
   * Check if hold can be cancelled (检查预留是否可以取消)
   * Only ACTIVE holds can be cancelled (只有ACTIVE预留可以取消)
   *
   * @returns true if can be cancelled (可以取消时返回true)
   */
  canBeCancelled(): boolean {
    return this.isActive();
  }

  /**
   * Check if hold can expire (检查预留是否可以过期)
   * Only ACTIVE holds can expire (只有ACTIVE预留可以过期)
   *
   * @returns true if can expire (可以过期时返回true)
   */
  canExpire(): boolean {
    return this.isActive();
  }

  /**
   * Check if hold can expire automatically (检查预留是否可以自动过期)
   * Only ACTIVE holds with expiry time can expire (只有设置了过期时间的ACTIVE预留可以过期)
   *
   * @param expiryAt - Expiration timestamp (过期时间戳)
   * @returns true if can expire automatically (可以自动过期时返回true)
   */
  canExpireAutomatically(expiryAt: Date | null): boolean {
    return this.isActive() && expiryAt !== null && expiryAt <= new Date();
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
   * Check equality with another HoldStatus (检查与另一个HoldStatus是否相等)
   *
   * @param other - HoldStatus to compare (要比较的HoldStatus)
   * @returns true if values are equal (值相等时返回true)
   */
  equals(other: HoldStatus): boolean {
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
 * InvalidHoldStatusException (无效预留状态异常)
 */
export class InvalidHoldStatusException extends DomainException {
  constructor(status: string) {
    super(
      'INVALID_HOLD_STATUS',
      `Invalid hold status: ${status}`,
      { status },
    );
  }
}

/**
 * InvalidHoldStatusTransitionException (无效预留状态转换异常)
 */
export class InvalidHoldStatusTransitionException extends DomainException {
  constructor(from: string, to: string) {
    super(
      'INVALID_HOLD_STATUS_TRANSITION',
      `Invalid hold status transition from ${from} to ${to}`,
      { from, to },
    );
  }
}
