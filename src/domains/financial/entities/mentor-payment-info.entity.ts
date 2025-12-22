/**
 * MentorPaymentInfo Entity (导师支付信息实体)
 * Represents mentor payment configuration and details (表示导师支付配置和详情)
 */

import { v4 as uuidv4 } from 'uuid';
import { DomainException } from '@core/exceptions/domain.exception';

// Payment method types (支付方式类型)
export type PaymentMethod =
  | 'DOMESTIC_TRANSFER'
  | 'CHANNEL_BATCH_PAY'
  | 'GUSTO'
  | 'GUSTO_INTERNATIONAL'
  | 'CHECK';

// Payment details interface (支付详情接口)
export interface PaymentDetails {
  // Domestic Transfer (国内转账)
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  routingNumber?: string;

  // Gusto (Gusto支付)
  employeeId?: string;
  companyId?: string;

  // Check (支票)
  payee?: string;
  address?: string;
}

// Entity properties interface (实体属性接口)
interface MentorPaymentInfoProps {
  id: string;
  mentorId: string;
  paymentCurrency: string;
  paymentMethod: PaymentMethod;
  paymentDetails: PaymentDetails;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

export class MentorPaymentInfo {
  private constructor(private readonly props: MentorPaymentInfoProps) {}

  /**
   * Create a new mentor payment info (创建新的导师支付信息)
   *
   * @param mentorId - Mentor ID (导师ID)
   * @param paymentCurrency - Payment currency (支付货币)
   * @param paymentMethod - Payment method (支付方式)
   * @param paymentDetails - Payment details (支付详情)
   * @param createdBy - Creator ID (创建人ID)
   * @returns MentorPaymentInfo instance (MentorPaymentInfo实例)
   */
  static create(
    mentorId: string,
    paymentCurrency: string,
    paymentMethod: PaymentMethod,
    paymentDetails: PaymentDetails,
    createdBy?: string,
  ): MentorPaymentInfo {
    if (!mentorId || mentorId.trim().length === 0) {
      throw new InvalidMentorIdException(mentorId);
    }

    if (!paymentCurrency || paymentCurrency.length !== 3) {
      throw new InvalidPaymentCurrencyException(paymentCurrency);
    }

    if (!paymentMethod || paymentMethod.trim().length === 0) {
      throw new InvalidPaymentMethodException(paymentMethod);
    }

    if (!paymentDetails || Object.keys(paymentDetails).length === 0) {
      throw new InvalidPaymentDetailsException('Payment details cannot be empty');
    }

    // Validate payment details based on payment method
    validatePaymentDetails(paymentMethod, paymentDetails);

    const now = new Date();

    return new MentorPaymentInfo({
      id: uuidv4(),
      mentorId,
      paymentCurrency: paymentCurrency.toUpperCase(),
      paymentMethod,
      paymentDetails,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      createdBy,
    });
  }

  /**
   * Reconstruct a MentorPaymentInfo from persistence data (从持久化数据重建MentorPaymentInfo)
   *
   * @param props - MentorPaymentInfo properties (MentorPaymentInfo属性)
   * @returns MentorPaymentInfo instance (MentorPaymentInfo实例)
   * @internal For use by mappers only (仅供Mapper使用)
   */
  static reconstruct(props: MentorPaymentInfoProps): MentorPaymentInfo {
    return new MentorPaymentInfo({
      ...props,
    });
  }

  /**
   * Update payment details (更新支付详情)
   *
   * @param paymentDetails - New payment details (新的支付详情)
   * @param updatedBy - User ID who updated (更新人ID)
   */
  updatePaymentDetails(paymentDetails: PaymentDetails, updatedBy: string): void {
    if (!paymentDetails || Object.keys(paymentDetails).length === 0) {
      throw new InvalidPaymentDetailsException('Payment details cannot be empty');
    }

    validatePaymentDetails(this.props.paymentMethod, paymentDetails);

    (this.props as any).paymentDetails = paymentDetails;
    (this.props as any).updatedBy = updatedBy;
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Update payment method (更新支付方式)
   *
   * @param paymentMethod - New payment method (新的支付方式)
   * @param paymentDetails - New payment details (新的支付详情)
   * @param updatedBy - User ID who updated (更新人ID)
   */
  updatePaymentMethod(
    paymentMethod: PaymentMethod,
    paymentDetails: PaymentDetails,
    updatedBy: string,
  ): void {
    if (!paymentMethod || paymentMethod.trim().length === 0) {
      throw new InvalidPaymentMethodException(paymentMethod);
    }

    if (!paymentDetails || Object.keys(paymentDetails).length === 0) {
      throw new InvalidPaymentDetailsException('Payment details cannot be empty');
    }

    validatePaymentDetails(paymentMethod, paymentDetails);

    (this.props as any).paymentMethod = paymentMethod;
    (this.props as any).paymentDetails = paymentDetails;
    (this.props as any).updatedBy = updatedBy;
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Activate the payment info (激活支付信息)
   *
   * @param updatedBy - User ID who updated (更新人ID)
   */
  activate(updatedBy: string): void {
    if (this.props.status === 'ACTIVE') {
      throw new AlreadyActiveException(this.props.id);
    }

    (this.props as any).status = 'ACTIVE';
    (this.props as any).updatedBy = updatedBy;
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Deactivate the payment info (停用支付信息)
   *
   * @param updatedBy - User ID who updated (更新人ID)
   */
  deactivate(updatedBy: string): void {
    if (this.props.status === 'INACTIVE') {
      throw new AlreadyInactiveException(this.props.id);
    }

    (this.props as any).status = 'INACTIVE';
    (this.props as any).updatedBy = updatedBy;
    (this.props as any).updatedAt = new Date();
  }

  /**
   * Check if payment info is active (检查是否激活)
   *
   * @returns true if active (激活时返回true)
   */
  isActive(): boolean {
    return this.props.status === 'ACTIVE';
  }

  // Getters
  getId(): string {
    return this.props.id;
  }

  getMentorId(): string {
    return this.props.mentorId;
  }

  getPaymentCurrency(): string {
    return this.props.paymentCurrency;
  }

  getPaymentMethod(): PaymentMethod {
    return this.props.paymentMethod;
  }

  getPaymentDetails(): PaymentDetails {
    return { ...this.props.paymentDetails };
  }

  getStatus(): 'ACTIVE' | 'INACTIVE' {
    return this.props.status;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  getCreatedBy(): string | undefined {
    return this.props.createdBy;
  }

  getUpdatedBy(): string | undefined {
    return this.props.updatedBy;
  }
}

/**
 * Validate payment details based on payment method (根据支付方式验证支付详情)
 *
 * @param paymentMethod - Payment method (支付方式)
 * @param paymentDetails - Payment details (支付详情)
 */
function validatePaymentDetails(paymentMethod: PaymentMethod, paymentDetails: PaymentDetails): void {
  switch (paymentMethod) {
    case 'DOMESTIC_TRANSFER':
      if (!paymentDetails.bankName || !paymentDetails.accountNumber || !paymentDetails.accountHolder) {
        throw new InvalidPaymentDetailsException(
          'DOMESTIC_TRANSFER requires bankName, accountNumber, and accountHolder',
        );
      }
      break;

    case 'GUSTO':
    case 'GUSTO_INTERNATIONAL':
      if (!paymentDetails.employeeId || !paymentDetails.companyId) {
        throw new InvalidPaymentDetailsException(
          'GUSTO and GUSTO_INTERNATIONAL require employeeId and companyId',
        );
      }
      break;

    case 'CHECK':
      if (!paymentDetails.payee || !paymentDetails.address) {
        throw new InvalidPaymentDetailsException('CHECK requires payee and address');
      }
      break;

    case 'CHANNEL_BATCH_PAY':
      // Channel batch pay might have different requirements
      // Add validation rules as needed
      break;

    default:
      throw new InvalidPaymentMethodException(paymentMethod);
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
 * InvalidPaymentCurrencyException (无效支付货币异常)
 */
export class InvalidPaymentCurrencyException extends DomainException {
  constructor(currency: string) {
    super(
      'INVALID_PAYMENT_CURRENCY',
      `Invalid payment currency: ${currency}. Must be 3-letter ISO 4217 code.`,
      { currency },
    );
  }
}

/**
 * InvalidPaymentMethodException (无效支付方式异常)
 */
export class InvalidPaymentMethodException extends DomainException {
  constructor(method: string) {
    super(
      'INVALID_PAYMENT_METHOD',
      `Invalid payment method: ${method}`,
      { method },
    );
  }
}

/**
 * InvalidPaymentDetailsException (无效支付详情异常)
 */
export class InvalidPaymentDetailsException extends DomainException {
  constructor(message: string) {
    super(
      'INVALID_PAYMENT_DETAILS',
      message,
      { message },
    );
  }
}

/**
 * AlreadyActiveException (已激活异常)
 */
export class AlreadyActiveException extends DomainException {
  constructor(paymentInfoId: string) {
    super(
      'ALREADY_ACTIVE',
      `Payment info ${paymentInfoId} is already active`,
      { paymentInfoId },
    );
  }
}

/**
 * AlreadyInactiveException (已停用异常)
 */
export class AlreadyInactiveException extends DomainException {
  constructor(paymentInfoId: string) {
    super(
      'ALREADY_INACTIVE',
      `Payment info ${paymentInfoId} is already inactive`,
      { paymentInfoId },
    );
  }
}
