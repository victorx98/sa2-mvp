/**
 * ServiceHold Entity (服务预留实体)
 * Represents a service hold/reservation to prevent over-booking (表示服务预留，用于防止超额预约)
 * Follows state machine pattern with status transitions (遵循状态机模式，具有状态转换)
 */

import { v4 as uuidv4 } from 'uuid';
import { HoldStatus } from '../value-objects/hold-status.vo';
import { DomainException } from '@core/exceptions/domain.exception';

// ServiceHold properties interface (ServiceHold属性接口)
interface ServiceHoldProps {
  id: string;
  contractId: string;
  studentId: string;
  serviceType: string;
  quantity: number;
  status: HoldStatus;
  relatedBookingId?: string;
  expiryAt?: Date;
  releasedAt?: Date;
  releaseReason?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export class ServiceHold {
  private constructor(private readonly props: ServiceHoldProps) {}

  /**
   * Create a new service hold (创建新的服务预留)
   *
   * @param contractId - Contract ID (合约ID)
   * @param studentId - Student ID (学生ID)
   * @param serviceType - Service type code (服务类型编码)
   * @param quantity - Quantity to hold (must be positive) (预留数量（必须为正数）)
   * @param createdBy - Creator user ID (创建人ID)
   * @param options - Optional parameters (可选参数)
   * @returns ServiceHold instance (ServiceHold实例)
   * @throws InvalidHoldQuantityException if quantity is not positive (数量不是正数时抛出InvalidHoldQuantityException)
   * @throws HoldAlreadyExistsException if hold already exists for the booking (已为预约创建预留时抛出HoldAlreadyExistsException)
   */
  static create(
    contractId: string,
    studentId: string,
    serviceType: string,
    quantity: number,
    createdBy: string,
    options?: {
      relatedBookingId?: string;
      expiryAt?: Date;
    },
  ): ServiceHold {
    if (quantity <= 0) {
      throw new InvalidHoldQuantityException(quantity);
    }

    const now = new Date();

    return new ServiceHold({
      id: uuidv4(),
      contractId,
      studentId,
      serviceType,
      quantity,
      status: HoldStatus.ACTIVE,
      relatedBookingId: options?.relatedBookingId,
      expiryAt: options?.expiryAt,
      releasedAt: undefined,
      releaseReason: undefined,
      createdAt: now,
      updatedAt: now,
      createdBy,
    });
  }

  /**
   * Reconstruct a ServiceHold from persistence data (从持久化数据重建ServiceHold)
   *
   * @param props - ServiceHold properties (ServiceHold属性)
   * @returns ServiceHold instance (ServiceHold实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(props: ServiceHoldProps): ServiceHold {
    return new ServiceHold({
      ...props,
      status: props.status instanceof HoldStatus ? props.status : HoldStatus.reconstruct(props.status as any),
    });
  }

  /**
   * Release the hold (释放预留)
   * Valid transition: ACTIVE → RELEASED (有效转换：ACTIVE → RELEASED)
   *
   * @param reason - Reason for release (释放原因)
   * @param releasedBy - User ID who released the hold (释放预留的用户ID)
   * @throws HoldNotActiveException if hold is not in ACTIVE status (预留不处于ACTIVE状态时抛出HoldNotActiveException)
   */
  release(reason: string, releasedBy: string): void {
    if (!this.props.status.canBeReleased()) {
      throw new HoldNotActiveException(this.props.id, this.props.status.getValue());
    }

    (this.props as any).status = this.props.status.transitionToReleased();
    (this.props as any).releasedAt = new Date();
    (this.props as any).releaseReason = reason;
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Cancel the hold (取消预留)
   * Valid transition: ACTIVE → CANCELLED (有效转换：ACTIVE → CANCELLED)
   *
   * @param reason - Reason for cancellation (取消原因)
   * @param cancelledBy - User ID who cancelled the hold (取消预留的用户ID)
   * @throws HoldNotActiveException if hold is not in ACTIVE status (预留不处于ACTIVE状态时抛出HoldNotActiveException)
   */
  cancel(reason: string, cancelledBy: string): void {
    if (!this.props.status.canBeCancelled()) {
      throw new HoldNotActiveException(this.props.id, this.props.status.getValue());
    }

    (this.props as any).status = this.props.status.transitionToCancelled();
    (this.props as any).releasedAt = new Date();
    (this.props as any).releaseReason = reason;
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Mark the hold as expired (标记预留为已过期)
   * Valid transition: ACTIVE → EXPIRED (有效转换：ACTIVE → EXPIRED)
   *
   * @throws HoldNotActiveException if hold is not in ACTIVE status (预留不处于ACTIVE状态时抛出HoldNotActiveException)
   * @throws HoldCannotExpireException if hold doesn't have expiry time or hasn't expired yet (预留没有过期时间或尚未到期时抛出HoldCannotExpireException)
   */
  markAsExpired(): void {
    if (!this.props.status.canBeReleased()) {
      throw new HoldNotActiveException(this.props.id, this.props.status.getValue());
    }

    if (!this.props.expiryAt || this.props.expiryAt > new Date()) {
      throw new HoldCannotExpireException(
        this.props.id,
        this.props.expiryAt,
        'Hold does not have expiry time or has not expired yet',
      );
    }

    (this.props as any).status = this.props.status.transitionToExpired();
    (this.props as any).releasedAt = new Date();
    (this.props as any).releaseReason = 'expired';
    (this.props as any).updatedAt = new Date();
  }

  // Getters
  getId(): string {
    return this.props.id;
  }

  getContractId(): string {
    return this.props.contractId;
  }

  getStudentId(): string {
    return this.props.studentId;
  }

  getServiceType(): string {
    return this.props.serviceType;
  }

  getQuantity(): number {
    return this.props.quantity;
  }

  getStatus(): HoldStatus {
    return this.props.status;
  }

  getRelatedBookingId(): string | undefined {
    return this.props.relatedBookingId;
  }

  getExpiryAt(): Date | undefined {
    return this.props.expiryAt;
  }

  getReleasedAt(): Date | undefined {
    return this.props.releasedAt;
  }

  getReleaseReason(): string | undefined {
    return this.props.releaseReason;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  getCreatedBy(): string {
    return this.props.createdBy;
  }

  /**
   * Check if hold is active (检查预留是否为活动状态)
   *
   * @returns true if active (活动状态时返回true)
   */
  isActive(): boolean {
    return this.props.status.isActive();
  }

  /**
   * Check if hold has been released (检查预留是否已释放)
   *
   * @returns true if released (已释放时返回true)
   */
  isReleased(): boolean {
    return this.props.status.isReleased();
  }

  /**
   * Check if hold has been cancelled (检查预留是否已取消)
   *
   * @returns true if cancelled (已取消时返回true)
   */
  isCancelled(): boolean {
    return this.props.status.isCancelled();
  }

  /**
   * Check if hold has expired (检查预留是否已过期)
   *
   * @returns true if expired (已过期时返回true)
   */
  isExpired(): boolean {
    return this.props.status.isExpired();
  }

  /**
   * Check if hold has been finalized (released, cancelled, or expired) (检查预留是否已结束（释放、取消或过期）)
   *
   * @returns true if finalized (已结束时返回true)
   */
  isFinalized(): boolean {
    return !this.isActive();
  }

  /**
   * Check if hold has expired based on current time (根据当前时间检查预留是否已过期)
   *
   * @returns true if expired (已过期时返回true)
   */
  hasExpired(): boolean {
    return this.props.expiryAt !== undefined && this.props.expiryAt <= new Date();
  }
}

/**
 * InvalidHoldQuantityException (无效预留数量异常)
 */
export class InvalidHoldQuantityException extends DomainException {
  constructor(quantity: number) {
    super(
      'INVALID_HOLD_QUANTITY',
      `Invalid hold quantity: ${quantity}. Must be a positive number`,
      { quantity },
    );
  }
}

/**
 * HoldNotActiveException (预留不是活动状态异常)
 */
export class HoldNotActiveException extends DomainException {
  constructor(holdId: string, status: string) {
    super(
      'HOLD_NOT_ACTIVE',
      `Hold ${holdId} is in ${status} status and cannot be modified`,
      { holdId, status },
    );
  }
}

/**
 * HoldCannotExpireException (预留不能过期异常)
 */
export class HoldCannotExpireException extends DomainException {
  constructor(holdId: string, expiryAt: Date | undefined, message: string) {
    super(
      'HOLD_CANNOT_EXPIRE',
      `Hold ${holdId} cannot expire: ${message}`,
      { holdId, expiryAt, message },
    );
  }
}

/**
 * HoldAlreadyExistsException (预留已存在异常)
 */
export class HoldAlreadyExistsException extends DomainException {
  constructor(bookingId: string) {
    super(
      'HOLD_ALREADY_EXISTS',
      `Hold already exists for booking ${bookingId}`,
      { bookingId },
    );
  }
}
