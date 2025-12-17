/**
 * Placement Events Catalog
 * 就业安置事件目录
 *
 * Centralized catalog for all placement/job application domain events.
 * These events track the lifecycle of job applications and referrals.
 *
 * 集中管理所有就业安置/工作申请领域事件的目录。
 * 这些事件跟踪工作申请和推荐的生命周期。
 */

import {
  EventCatalogEntry,
  EventDomain,
  EventType,
  ConsumerPriority,
  ErrorHandlingStrategy,
} from "./types";

import {
  JOB_APPLICATION_STATUS_CHANGED_EVENT,
  JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
  PLACEMENT_APPLICATION_SUBMITTED_EVENT,
} from "@shared/events/event-constants";

/**
 * Placement Events Catalog
 * Maps placement event name constants to their full metadata
 * 就业安置事件目录 - 将就业安置事件名称常量映射到完整元数据
 */
export const PlacementEventsCatalog: Record<string, EventCatalogEntry> = {
  // ============================================================
  // Job Application Events (工作申请事件)
  // ============================================================

  [JOB_APPLICATION_STATUS_CHANGED_EVENT]: {
    name: JOB_APPLICATION_STATUS_CHANGED_EVENT,
    description:
      "Job application status changed. Triggers service entitlement consumption and financial tracking.",
    descriptionCN:
      "工作申请状态变更。触发服务权益消耗和财务追踪。",
    domain: EventDomain.PLACEMENT,
    eventType: EventType.STATE_CHANGE,
    payloadType: "IJobApplicationStatusChangedEvent",
    producers: [
      "JobApplicationService.createApplication",
      "JobApplicationService.updateApplicationStatus",
      "JobApplicationService.createApplicationWithoutReferral",
    ],
    consumers: [
      {
        handler: "PlacementEventListener",
        priority: ConsumerPriority.CRITICAL,
        async: false,
        module: "domains/contract",
        description:
          "Record placement application consumption in service ledger based on status transition",
        errorStrategy: ErrorHandlingStrategy.FAIL_FAST,
      },
      {
        handler: "PlacementApplicationStatusChangedListener",
        priority: ConsumerPriority.HIGH,
        async: false,
        module: "domains/financial",
        description: "Record entitlement consumption for placement services",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    triggers: [PLACEMENT_APPLICATION_SUBMITTED_EVENT],
    tags: ["placement", "application", "status", "billing"],
    version: "1.0",
  },

  [JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT]: {
    name: JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
    description:
      "Job application status rolled back. Triggers entitlement refund and consumption reversal.",
    descriptionCN:
      "工作申请状态回滚。触发权益退还和消耗冲销。",
    domain: EventDomain.PLACEMENT,
    eventType: EventType.STATE_CHANGE,
    payloadType: "IJobApplicationStatusRolledBackEvent",
    producers: ["JobApplicationService.rollbackApplicationStatus"],
    consumers: [
      {
        handler: "PlacementEventListener",
        priority: ConsumerPriority.CRITICAL,
        async: false,
        module: "domains/contract",
        description:
          "Reverse placement application consumption in service ledger",
        errorStrategy: ErrorHandlingStrategy.FAIL_FAST,
      },
      {
        handler: "PlacementApplicationStatusRolledBackListener",
        priority: ConsumerPriority.HIGH,
        async: false,
        module: "domains/financial",
        description: "Refund entitlement consumption on rollback",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    requires: [JOB_APPLICATION_STATUS_CHANGED_EVENT],
    tags: ["placement", "application", "rollback", "refund"],
    version: "1.0",
  },

  [PLACEMENT_APPLICATION_SUBMITTED_EVENT]: {
    name: PLACEMENT_APPLICATION_SUBMITTED_EVENT,
    description:
      "Placement application submitted (first status change). Initial milestone in placement journey.",
    descriptionCN:
      "就业申请已提交（首次状态变更）。就业旅程的初始里程碑。",
    domain: EventDomain.PLACEMENT,
    eventType: EventType.STATE_CHANGE,
    payloadType: "PlacementApplicationSubmittedEvent",
    producers: [
      "JobApplicationService.createApplication",
      "JobApplicationService.createApplicationWithoutReferral",
    ],
    consumers: [
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify counselor/student of application submission",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
      {
        handler: "AnalyticsCollector",
        priority: ConsumerPriority.BACKGROUND,
        async: true,
        module: "analytics",
        description: "Track placement application metrics",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    tags: ["placement", "application", "submission", "milestone"],
    version: "1.0",
  },
};

/**
 * Get all placement event names
 * 获取所有就业安置事件名称
 */
export const getAllPlacementEventNames = (): string[] => {
  return Object.keys(PlacementEventsCatalog);
};

/**
 * Check if event is a placement event
 * 检查事件是否为就业安置事件
 */
export const isPlacementEvent = (eventName: string): boolean => {
  return eventName in PlacementEventsCatalog;
};

/**
 * Get placement events that affect billing
 * 获取影响计费的就业安置事件
 */
export const getPlacementBillingEvents = (): EventCatalogEntry[] => {
  return Object.values(PlacementEventsCatalog).filter(
    (entry) => entry.tags?.includes("billing") || entry.tags?.includes("refund"),
  );
};
