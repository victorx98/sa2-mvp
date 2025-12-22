/**
 * MentorPayableLedger Entity (导师应付账款实体)
 * Represents a payable ledger entry for mentor services (表示导师服务的应付账款记录)
 */

import { v4 as uuidv4 } from 'uuid';
import { Money, CurrencyMismatchException } from '../value-objects/money.vo';
import { DomainException } from '@core/exceptions/domain.exception';

// Entity properties interface (实体属性接口)
interface MentorPayableLedgerProps {
  id: string;
  referenceId: string;
  mentorId: string;
  studentId?: string;
  sessionTypeCode: string;
  price: Money;
  amount: Money;
  originalId?: string;
  adjustmentReason?: string;
  settlementId?: string;
  settledAt?: Date;
  createdAt: Date;
  createdBy?: string;
}

export class MentorPayableLedger {
  private constructor(private readonly props: MentorPayableLedgerProps) {}

  /**
   * Create a new mentor payable ledger entry (创建新的导师应付账款记录)
   *
   * @param referenceId - Reference ID (关联ID)
   * @param mentorId - Mentor ID (导师ID)
   * @param sessionTypeCode - Session type code (会话类型代码)
   * @param price - Unit price (单价)
   * @param amount - Total amount (总金额)
   * @param studentId - Student ID (学生ID)
   * @param createdBy - Creator ID (创建人ID)
   * @returns MentorPayableLedger instance (MentorPayableLedger实例)
   */
  static create(
    referenceId: string,
    mentorId: string,
    sessionTypeCode: string,
    price: Money,
    amount: Money,
    options?: {
      studentId?: string;
      createdBy?: string;
    },
  ): MentorPayableLedger {
    if (!referenceId || referenceId.trim().length === 0) {
      throw new InvalidReferenceIdException(referenceId);
    }

    if (!mentorId || mentorId.trim().length === 0) {
      throw new InvalidMentorIdException(mentorId);
    }

    if (!sessionTypeCode || sessionTypeCode.trim().length === 0) {
      throw new InvalidSessionTypeCodeException(sessionTypeCode);
    }

    if (price.isZero()) {
      throw new InvalidPriceException('Price cannot be zero');
    }

    if (amount.getAmount() < 0) {
      throw new InvalidAmountException('Amount cannot be negative for original records');
    }

    const now = new Date();

    return new MentorPayableLedger({
      id: uuidv4(),
      referenceId,
      mentorId,
      studentId: options?.studentId,
      sessionTypeCode,
      price,
      amount,
      createdAt: now,
      createdBy: options?.createdBy,
    });
  }

  /**
   * Create an adjustment entry for an existing ledger (创建调整记录)
   *
   * @param originalLedger - Original ledger entry to adjust (要调整的原始记录)
   * @param adjustmentAmount - Adjustment amount (must have same currency) (调整金额)
   * @param adjustmentReason - Reason for adjustment (调整原因)
   * @param createdBy - Creator ID (创建人ID)
   * @returns Adjustment ledger entry (调整记录)
   */
  static createAdjustment(
    originalLedger: MentorPayableLedger,
    adjustmentAmount: Money,
    adjustmentReason: string,
    createdBy?: string,
  ): MentorPayableLedger {
    if (!adjustmentReason || adjustmentReason.trim().length === 0) {
      throw new InvalidAdjustmentReasonException(adjustmentReason);
    }

    if (originalLedger.getOriginalId()) {
      throw new InvalidAdjustmentException(
        'Cannot adjust an adjustment record. Only original records can be adjusted.',
      );
    }

    // Check currency match
    if (adjustmentAmount.getCurrency() !== originalLedger.getAmount().getCurrency()) {
      throw new CurrencyMismatchException(
        originalLedger.getAmount().getCurrency(),
        adjustmentAmount.getCurrency(),
      );
    }

    const originalAmount = originalLedger.getAmount().getAmount();
    const newAmount = originalAmount + adjustmentAmount.getAmount();

    if (newAmount < 0) {
      throw new InvalidAmountException(
        `Adjustment would result in negative total amount: ${newAmount}`,
      );
    }

    const now = new Date();

    return new MentorPayableLedger({
      id: uuidv4(),
      referenceId: originalLedger.getReferenceId(),
      mentorId: originalLedger.getMentorId(),
      studentId: originalLedger.getStudentId(),
      sessionTypeCode: originalLedger.getSessionTypeCode(),
      price: originalLedger.getPrice(),
      amount: adjustmentAmount,
      originalId: originalLedger.getId(),
      adjustmentReason,
      createdAt: now,
      createdBy,
    });
  }

  /**
   * Reconstruct a MentorPayableLedger from persistence data (从持久化数据重建MentorPayableLedger)
   *
   * @param props - MentorPayableLedger properties (MentorPayableLedger属性)
   * @returns MentorPayableLedger instance (MentorPayableLedger实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(props: MentorPayableLedgerProps): MentorPayableLedger {
    return new MentorPayableLedger({
      ...props,
      price: Money.reconstruct(props.price.getAmount(), props.price.getCurrency()),
      amount: Money.reconstruct(props.amount.getAmount(), props.amount.getCurrency()),
    });
  }

  /**
   * Mark the ledger as settled (标记为已结算)
   *
   * @param settlementId - Settlement ID (结算ID)
   * @param settledBy - User ID who performed settlement (执行结算的用户ID)
   */
  markAsSettled(settlementId: string, settledBy: string): void {
    if (!settlementId || settlementId.trim().length === 0) {
      throw new InvalidSettlementIdException(settlementId);
    }

    if (this.props.settlementId) {
      throw new AlreadySettledException(this.props.id, this.props.settlementId);
    }

    (this.props as any).settlementId = settlementId;
    (this.props as any).settledAt = new Date();
  }

  /**
   * Check if this ledger is settled (检查是否已结算)
   *
   * @returns true if settled (已结算时返回true)
   */
  isSettled(): boolean {
    return !!this.props.settlementId;
  }

  /**
   * Check if this is an adjustment record (检查是否为调整记录)
   *
   * @returns true if adjustment (是调整记录时返回true)
   */
  isAdjustment(): boolean {
    return !!this.props.originalId;
  }

  // Getters
  getId(): string {
    return this.props.id;
  }

  getReferenceId(): string {
    return this.props.referenceId;
  }

  getMentorId(): string {
    return this.props.mentorId;
  }

  getStudentId(): string | undefined {
    return this.props.studentId;
  }

  getSessionTypeCode(): string {
    return this.props.sessionTypeCode;
  }

  getPrice(): Money {
    return this.props.price;
  }

  getAmount(): Money {
    return this.props.amount;
  }

  getOriginalId(): string | undefined {
    return this.props.originalId;
  }

  getAdjustmentReason(): string | undefined {
    return this.props.adjustmentReason;
  }

  getSettlementId(): string | undefined {
    return this.props.settlementId;
  }

  getSettledAt(): Date | undefined {
    return this.props.settledAt;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getCreatedBy(): string | undefined {
    return this.props.createdBy;
  }
}

/**
 * InvalidReferenceIdException (无效关联ID异常)
 */
export class InvalidReferenceIdException extends DomainException {
  constructor(referenceId: string) {
    super(
      'INVALID_REFERENCE_ID',
      `Invalid reference ID: ${referenceId}`,
      { referenceId },
    );
  }
}

/**
 * InvalidMentorIdException (无效导师ID异常)
 */
export class InvalidMentorIdException extends DomainException {
  constructor(mentorId: string) {
    super(
      'INVALID_MENTOR_ID',
      `Invalid mentor ID: ${mentorId}`,
      { mentorId },
    );
  }
}

/**
 * InvalidSessionTypeCodeException (无效会话类型代码异常)
 */
export class InvalidSessionTypeCodeException extends DomainException {
  constructor(sessionTypeCode: string) {
    super(
      'INVALID_SESSION_TYPE_CODE',
      `Invalid session type code: ${sessionTypeCode}`,
      { sessionTypeCode },
    );
  }
}

/**
 * InvalidPriceException (无效价格异常)
 */
export class InvalidPriceException extends DomainException {
  constructor(message: string) {
    super(
      'INVALID_PRICE',
      message,
      { message },
    );
  }
}

/**
 * InvalidAmountException (无效金额异常)
 */
export class InvalidAmountException extends DomainException {
  constructor(message: string) {
    super(
      'INVALID_AMOUNT',
      message,
      { message },
    );
  }
}

/**
 * InvalidAdjustmentReasonException (无效调整原因异常)
 */
export class InvalidAdjustmentReasonException extends DomainException {
  constructor(reason: string) {
    super(
      'INVALID_ADJUSTMENT_REASON',
      `Invalid adjustment reason: ${reason}`,
      { reason },
    );
  }
}

/**
 * InvalidAdjustmentException (无效调整异常)
 */
export class InvalidAdjustmentException extends DomainException {
  constructor(message: string) {
    super(
      'INVALID_ADJUSTMENT',
      message,
      { message },
    );
  }
}

/**
 * InvalidSettlementIdException (无效结算ID异常)
 */
export class InvalidSettlementIdException extends DomainException {
  constructor(settlementId: string) {
    super(
      'INVALID_SETTLEMENT_ID',
      `Invalid settlement ID: ${settlementId}`,
      { settlementId },
    );
  }
}

/**
 * AlreadySettledException (已结算异常)
 */
export class AlreadySettledException extends DomainException {
  constructor(ledgerId: string, settlementId: string) {
    super(
      'ALREADY_SETTLED',
      `Ledger ${ledgerId} is already settled with settlement ${settlementId}`,
      { ledgerId, settlementId },
    );
  }
}
