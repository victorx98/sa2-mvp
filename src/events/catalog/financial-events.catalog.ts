/**
 * Financial Events Catalog
 * 财务事件目录
 *
 * Centralized catalog for all financial domain events including:
 * - Settlement events
 * - Appeal events
 * - Resume billing events
 *
 * 集中管理所有财务领域事件的目录，包括：
 * - 结算事件
 * - 申诉事件
 * - 简历计费事件
 */

import {
  EventCatalogEntry,
  EventDomain,
  EventType,
  ConsumerPriority,
  ErrorHandlingStrategy,
} from "./types";

import {
  SETTLEMENT_CONFIRMED_EVENT,
  MENTOR_APPEAL_CREATED_EVENT,
  MENTOR_APPEAL_APPROVED_EVENT,
  MENTOR_APPEAL_REJECTED_EVENT,
  RESUME_BILLED_EVENT,
  RESUME_BILL_CANCELLED_EVENT,
} from "@shared/events/event-constants";

/**
 * Financial Events Catalog
 * Maps financial event name constants to their full metadata
 * 财务事件目录 - 将财务事件名称常量映射到完整元数据
 */
export const FinancialEventsCatalog: Record<string, EventCatalogEntry> = {
  // ============================================================
  // Settlement Events (结算事件)
  // ============================================================

  [SETTLEMENT_CONFIRMED_EVENT]: {
    name: SETTLEMENT_CONFIRMED_EVENT,
    description:
      "Settlement record confirmed. Updates mentor payment parameters and marks payable ledgers as settled.",
    descriptionCN:
      "结算记录已确认。更新导师付款参数并将应付账款标记为已结算。",
    domain: EventDomain.FINANCIAL,
    eventType: EventType.STATE_CHANGE,
    payloadType: "ISettlementConfirmedEvent",
    producers: ["SettlementService.confirmSettlement"],
    consumers: [
      {
        handler: "SettlementConfirmedListener",
        priority: ConsumerPriority.CRITICAL,
        async: true,
        module: "domains/financial",
        description:
          "Update mentor payment parameters (exchange rate, deduction rate, settlement method)",
        errorStrategy: ErrorHandlingStrategy.RETRY,
        timeout: 30000,
      },
    ],
    tags: ["financial", "settlement", "payment"],
    version: "1.0",
  },

  // ============================================================
  // Appeal Events (申诉事件)
  // ============================================================

  [MENTOR_APPEAL_CREATED_EVENT]: {
    name: MENTOR_APPEAL_CREATED_EVENT,
    description:
      "Mentor appeal created. Used for tracking and notification purposes.",
    descriptionCN:
      "导师申诉已创建。用于追踪和通知目的。",
    domain: EventDomain.FINANCIAL,
    eventType: EventType.STATE_CHANGE,
    payloadType: "MentorAppealCreatedEvent",
    producers: ["MentorAppealService.createAppeal"],
    consumers: [
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify admin of new appeal",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    triggers: [MENTOR_APPEAL_APPROVED_EVENT, MENTOR_APPEAL_REJECTED_EVENT],
    tags: ["financial", "appeal", "mentor"],
    version: "1.0",
  },

  [MENTOR_APPEAL_APPROVED_EVENT]: {
    name: MENTOR_APPEAL_APPROVED_EVENT,
    description:
      "Mentor appeal approved. Creates payable ledger adjustment with idempotency check.",
    descriptionCN:
      "导师申诉已批准。创建应付账款调整（带幂等性检查）。",
    domain: EventDomain.FINANCIAL,
    eventType: EventType.RESULT,
    payloadType: "MentorAppealApprovedEvent",
    producers: ["MentorAppealService.approveAppeal"],
    consumers: [
      {
        handler: "AppealApprovedListener",
        priority: ConsumerPriority.CRITICAL,
        async: false,
        module: "domains/financial",
        description:
          "Create payable ledger adjustment for approved appeal amount",
        errorStrategy: ErrorHandlingStrategy.FAIL_FAST,
      },
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify mentor of appeal approval",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    requires: [MENTOR_APPEAL_CREATED_EVENT],
    tags: ["financial", "appeal", "mentor", "ledger-adjustment"],
    version: "1.0",
  },

  [MENTOR_APPEAL_REJECTED_EVENT]: {
    name: MENTOR_APPEAL_REJECTED_EVENT,
    description:
      "Mentor appeal rejected. Used for notification and audit trail.",
    descriptionCN:
      "导师申诉已拒绝。用于通知和审计追踪。",
    domain: EventDomain.FINANCIAL,
    eventType: EventType.RESULT,
    payloadType: "MentorAppealRejectedEvent",
    producers: ["MentorAppealService.rejectAppeal"],
    consumers: [
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify mentor of appeal rejection with reason",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    requires: [MENTOR_APPEAL_CREATED_EVENT],
    tags: ["financial", "appeal", "mentor"],
    version: "1.0",
  },

  // ============================================================
  // Resume Billing Events (简历计费事件)
  // ============================================================

  [RESUME_BILLED_EVENT]: {
    name: RESUME_BILLED_EVENT,
    description:
      "Resume service billed. Triggers service consumption recording.",
    descriptionCN:
      "简历服务已计费。触发服务消耗记录。",
    domain: EventDomain.FINANCIAL,
    eventType: EventType.STATE_CHANGE,
    payloadType: "ResumeBilledEvent",
    producers: ["ResumeService.billResume"],
    consumers: [
      {
        handler: "ServiceConsumptionRecorder",
        priority: ConsumerPriority.HIGH,
        async: false,
        module: "domains/contract",
        description: "Record resume service consumption in service ledger",
        errorStrategy: ErrorHandlingStrategy.FAIL_FAST,
      },
    ],
    tags: ["financial", "billing", "resume"],
    version: "1.0",
  },

  [RESUME_BILL_CANCELLED_EVENT]: {
    name: RESUME_BILL_CANCELLED_EVENT,
    description:
      "Resume billing cancelled. Triggers service consumption reversal.",
    descriptionCN:
      "简历计费已取消。触发服务消耗冲销。",
    domain: EventDomain.FINANCIAL,
    eventType: EventType.STATE_CHANGE,
    payloadType: "ResumeBillCancelledEvent",
    producers: ["ResumeService.cancelBill"],
    consumers: [
      {
        handler: "ServiceConsumptionRecorder",
        priority: ConsumerPriority.HIGH,
        async: false,
        module: "domains/contract",
        description: "Reverse resume service consumption in service ledger",
        errorStrategy: ErrorHandlingStrategy.FAIL_FAST,
      },
    ],
    requires: [RESUME_BILLED_EVENT],
    tags: ["financial", "billing", "resume", "reversal"],
    version: "1.0",
  },
};

/**
 * Get all financial event names
 * 获取所有财务事件名称
 */
export const getAllFinancialEventNames = (): string[] => {
  return Object.keys(FinancialEventsCatalog);
};

/**
 * Get financial events by type
 * 按事件类型获取财务事件
 */
export const getFinancialEventsByType = (
  eventType: EventType,
): EventCatalogEntry[] => {
  return Object.values(FinancialEventsCatalog).filter(
    (entry) => entry.eventType === eventType,
  );
};

/**
 * Check if event is a financial event
 * 检查事件是否为财务事件
 */
export const isFinancialEvent = (eventName: string): boolean => {
  return eventName in FinancialEventsCatalog;
};
