import { IEvent } from "./event.types";

// Event constants
export const RECOMM_LETTER_BILLED_EVENT = "recomm_letter.billed";
export const RECOMM_LETTER_BILL_CANCELLED_EVENT = "recomm_letter.bill.cancelled";

/**
 * Recommendation Letter Billed Event Payload
 */
export interface IRecommLetterBilledPayload {
  /**
   * Letter ID (used as sessionId for consistency)
   */
  sessionId?: string;

  /**
   * Student user ID
   */
  studentId: string;

  /**
   * Mentor user ID
   */
  mentorId?: string;

  /**
   * Reference ID (recommendation letter ID)
   */
  referenceId?: string;

  /**
   * Service type code
   */
  serviceTypeCode: string;

  /**
   * Letter type code
   */
  letterType: string;

  /**
   * Package type code (optional)
   */
  packageType?: string;

  /**
   * Description
   */
  description?: string;

  /**
   * Billed timestamp
   */
  billedAt?: Date;
}

/**
 * Recommendation Letter Bill Cancelled Event Payload
 */
export interface IRecommLetterBillCancelledPayload {
  /**
   * Letter ID (used as sessionId for consistency)
   */
  sessionId?: string;

  /**
   * Student user ID
   */
  studentId: string;

  /**
   * Mentor user ID
   */
  mentorId?: string;

  /**
   * Reference ID (recommendation letter ID)
   */
  referenceId?: string;

  /**
   * Service type code
   */
  serviceTypeCode: string;

  /**
   * Letter type code
   */
  letterType: string;

  /**
   * Package type code (optional)
   */
  packageType?: string;

  /**
   * Description
   */
  description?: string;

  /**
   * Cancelled timestamp
   */
  cancelledAt: Date;
}

export interface IRecommLetterBilledEvent
  extends IEvent<IRecommLetterBilledPayload> {
  type: typeof RECOMM_LETTER_BILLED_EVENT;
}

export interface IRecommLetterBillCancelledEvent
  extends IEvent<IRecommLetterBillCancelledPayload> {
  type: typeof RECOMM_LETTER_BILL_CANCELLED_EVENT;
}

