/**
 * ServiceLedger Entity (服务流水实体)
 * Represents an immutable service ledger entry (表示不可变的服务流水条目)
 * Follows append-only pattern - entries cannot be modified or deleted (遵循仅追加模式 - 条目不可修改或删除)
 */

import { v4 as uuidv4 } from 'uuid';
import { LedgerType } from '../value-objects/ledger-type.vo';
import { LedgerSource } from '../value-objects/ledger-source.vo';
import { DomainException } from '@core/exceptions/domain.exception';

// Service ledger metadata interface (服务流水元数据接口)
interface ServiceLedgerMetadata {
  bookingSource?: string; // Booking table name (预约表名)
}

// ServiceLedger properties interface (ServiceLedger属性接口)
interface ServiceLedgerProps {
  id: string;
  studentId: string;
  serviceType: string;
  quantity: number; // Negative for consumption, positive for refund/adjustment (负数表示消费，正数表示退款/调整)
  type: LedgerType;
  source: LedgerSource;
  balanceAfter: number; // Balance after this operation (操作后的余额)
  relatedHoldId?: string;
  relatedBookingId?: string;
  reason?: string;
  createdAt: Date;
  createdBy: string;
  metadata: ServiceLedgerMetadata;
}

export class ServiceLedger {
  private constructor(private readonly props: ServiceLedgerProps) {}

  /**
   * Create a new consumption ledger entry (创建新的消费流水条目)
   *
   * @param studentId - Student ID (学生ID)
   * @param serviceType - Service type code (服务类型编码)
   * @param quantity - Quantity to consume (positive number, will be stored as negative) (消费数量（正数，将存储为负数）)
   * @param currentBalance - Current balance before consumption (消费前的当前余额)
   * @param createdBy - Creator user ID (创建人ID)
   * @param options - Optional parameters (可选参数)
   * @returns ServiceLedger instance (ServiceLedger实例)
   * @throws InsufficientBalanceException if current balance is insufficient (余额不足时抛出InsufficientBalanceException)
   */
  static recordConsumption(
    studentId: string,
    serviceType: string,
    quantity: number,
    currentBalance: number,
    createdBy: string,
    options?: {
      relatedHoldId?: string;
      relatedBookingId?: string;
      bookingSource?: string;
    },
  ): ServiceLedger {
    if (quantity <= 0) {
      throw new InvalidConsumptionQuantityException(quantity);
    }

    if (currentBalance < quantity) {
      throw new InsufficientBalanceException(studentId, serviceType, currentBalance, quantity);
    }

    const balanceAfter = currentBalance - quantity;

    return new ServiceLedger({
      id: uuidv4(),
      studentId,
      serviceType,
      quantity: -quantity, // Store as negative for consumption (存储为负数表示消费)
      type: LedgerType.CONSUMPTION,
      source: LedgerSource.BOOKING_COMPLETED, // Default source for consumption (消费的默认来源)
      balanceAfter,
      relatedHoldId: options?.relatedHoldId,
      relatedBookingId: options?.relatedBookingId,
      createdAt: new Date(),
      createdBy,
      metadata: {
        bookingSource: options?.bookingSource,
      },
    });
  }

  /**
   * Create a new refund ledger entry (创建新的退款流水条目)
   *
   * @param studentId - Student ID (学生ID)
   * @param serviceType - Service type code (服务类型编码)
   * @param quantity - Quantity to refund (positive number) (退款数量（正数）)
   * @param currentBalance - Current balance before refund (退款前的当前余额)
   * @param createdBy - Creator user ID (创建人ID)
   * @param relatedBookingId - Associated booking ID (关联预约ID)
   * @param bookingSource - Booking table name (预约表名)
   * @returns ServiceLedger instance (ServiceLedger实例)
   * @throws InvalidRefundQuantityException if quantity is not positive (数量不是正数时抛出InvalidRefundQuantityException)
   */
  static recordRefund(
    studentId: string,
    serviceType: string,
    quantity: number,
    currentBalance: number,
    createdBy: string,
    relatedBookingId: string,
    bookingSource: string,
  ): ServiceLedger {
    if (quantity <= 0) {
      throw new InvalidRefundQuantityException(quantity);
    }

    const balanceAfter = currentBalance + quantity;

    return new ServiceLedger({
      id: uuidv4(),
      studentId,
      serviceType,
      quantity,
      type: LedgerType.REFUND,
      source: LedgerSource.BOOKING_CANCELLED,
      balanceAfter,
      relatedBookingId,
      createdAt: new Date(),
      createdBy,
      metadata: {
        bookingSource,
      },
    });
  }

  /**
   * Create a new adjustment ledger entry (创建新的调整流水条目)
   *
   * @param studentId - Student ID (学生ID)
   * @param serviceType - Service type code (服务类型编码)
   * @param quantity - Quantity adjustment (can be positive or negative) (数量调整（可正可负）)
   * @param currentBalance - Current balance before adjustment (调整前的当前余额)
   * @param reason - Reason for adjustment (调整原因)
   * @param createdBy - Creator user ID (创建人ID)
   * @returns ServiceLedger instance (ServiceLedger实例)
   * @throws InvalidAdjustmentException if resulting balance would be negative (调整后余额为负时抛出InvalidAdjustmentException)
   */
  static recordAdjustment(
    studentId: string,
    serviceType: string,
    quantity: number,
    currentBalance: number,
    reason: string,
    createdBy: string,
  ): ServiceLedger {
    if (!reason || reason.trim().length === 0) {
      throw new InvalidAdjustmentException('Reason is required for adjustments');
    }

    const balanceAfter = currentBalance + quantity;

    if (balanceAfter < 0) {
      throw new InvalidAdjustmentException(
        `Adjustment would result in negative balance: ${balanceAfter}`,
      );
    }

    return new ServiceLedger({
      id: uuidv4(),
      studentId,
      serviceType,
      quantity,
      type: LedgerType.ADJUSTMENT,
      source: LedgerSource.MANUAL_ADJUSTMENT,
      balanceAfter,
      reason,
      createdAt: new Date(),
      createdBy,
      metadata: {},
    });
  }

  /**
   * Reconstruct a ServiceLedger from persistence data (从持久化数据重建ServiceLedger)
   *
   * @param props - ServiceLedger properties (ServiceLedger属性)
   * @returns ServiceLedger instance (ServiceLedger实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(props: ServiceLedgerProps): ServiceLedger {
    return new ServiceLedger({
      ...props,
      type: props.type instanceof LedgerType ? props.type : LedgerType.reconstruct(props.type as any),
      source:
        props.source instanceof LedgerSource
          ? props.source
          : LedgerSource.reconstruct(props.source as any),
    });
  }

  // Getters
  getId(): string {
    return this.props.id;
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

  getType(): LedgerType {
    return this.props.type;
  }

  getSource(): LedgerSource {
    return this.props.source;
  }

  getBalanceAfter(): number {
    return this.props.balanceAfter;
  }

  getRelatedHoldId(): string | undefined {
    return this.props.relatedHoldId;
  }

  getRelatedBookingId(): string | undefined {
    return this.props.relatedBookingId;
  }

  getReason(): string | undefined {
    return this.props.reason;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getCreatedBy(): string {
    return this.props.createdBy;
  }

  getMetadata(): ServiceLedgerMetadata {
    return { ...this.props.metadata };
  }

  /**
   * Check if this is a consumption entry (检查是否为消费条目)
   *
   * @returns true if consumption (是消费时返回true)
   */
  isConsumption(): boolean {
    return this.props.type.isConsumption();
  }

  /**
   * Check if this is a refund entry (检查是否为退款条目)
   *
   * @returns true if refund (是退款时返回true)
   */
  isRefund(): boolean {
    return this.props.type.isRefund();
  }

  /**
   * Check if this is an adjustment entry (检查是否为调整条目)
   *
   * @returns true if adjustment (是调整时返回true)
   */
  isAdjustment(): boolean {
    return this.props.type.isAdjustment();
  }
}

/**
 * InsufficientBalanceException (余额不足异常)
 */
export class InsufficientBalanceException extends DomainException {
  constructor(
    studentId: string,
    serviceType: string,
    currentBalance: number,
    requestedQuantity: number,
  ) {
    super(
      'INSUFFICIENT_BALANCE',
      `Insufficient balance for student ${studentId}, service type ${serviceType}. ` +
        `Current balance: ${currentBalance}, requested: ${requestedQuantity}`,
      { studentId, serviceType, currentBalance, requestedQuantity },
    );
  }
}

/**
 * InvalidConsumptionQuantityException (无效消费数量异常)
 */
export class InvalidConsumptionQuantityException extends DomainException {
  constructor(quantity: number) {
    super(
      'INVALID_CONSUMPTION_QUANTITY',
      `Invalid consumption quantity: ${quantity}. Must be a positive number`,
      { quantity },
    );
  }
}

/**
 * InvalidRefundQuantityException (无效退款数量异常)
 */
export class InvalidRefundQuantityException extends DomainException {
  constructor(quantity: number) {
    super(
      'INVALID_REFUND_QUANTITY',
      `Invalid refund quantity: ${quantity}. Must be a positive number`,
      { quantity },
    );
  }
}

/**
 * InvalidAdjustmentException (无效调整异常)
 */
export class InvalidAdjustmentException extends DomainException {
  constructor(message: string) {
    super('INVALID_ADJUSTMENT', message, { message });
  }
}
