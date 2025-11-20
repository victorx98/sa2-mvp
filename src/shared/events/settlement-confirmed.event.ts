import { IEvent } from "./event.types";
import { SETTLEMENT_CONFIRMED_EVENT } from "./event-constants";

/**
 * Payload for settlement confirmed event
 * 结算确认事件载荷
 */
export interface ISettlementConfirmedPayload {
  /**
   * Settlement ID (结算ID)
   */
  settlementId: string;

  /**
   * Mentor ID (导师ID)
   */
  mentorId: string;

  /**
   * Settlement Month (结算月份)
   */
  settlementMonth: string;

  /**
   * Original Amount (原始金额)
   */
  originalAmount: number;

  /**
   * Target Amount (目标金额)
   */
  targetAmount: number;

  /**
   * Original Currency (原始币种)
   */
  originalCurrency: string;

  /**
   * Target Currency (目标币种)
   */
  targetCurrency: string;

  /**
   * Exchange Rate (汇率)
   */
  exchangeRate: number;

  /**
   * Deduction Rate (扣除比率)
   */
  deductionRate: number;

  /**
   * Settlement Method (结算方式)
   */
  settlementMethod: string;

  /**
   * Creator User ID (创建人用户ID)
   */
  createdBy: string;

  /**
   * Creation Timestamp (创建时间戳)
   */
  createdAt: Date;

  /**
   * Associated Payable Ledger IDs (关联的应付账款ID列表)
   */
  payableLedgerIds: string[];
}

/**
 * Settlement Confirmed Event Interface
 * 结算确认事件接口
 *
 * This event is published when a settlement record is created and confirmed.
 * 当结算记录创建并确认时发布此事件。
 */
export interface ISettlementConfirmedEvent
  extends IEvent<ISettlementConfirmedPayload> {
  type: typeof SETTLEMENT_CONFIRMED_EVENT;
}
