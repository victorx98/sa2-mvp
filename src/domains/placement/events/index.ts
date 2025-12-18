/**
 * Placement domain events export file
 * [Placement domain 事件导出文件]
 */

// Re-export placement event constants from shared event-constants
// [从共享event-constants重新导出placement事件常量]
export {
  JOB_APPLICATION_STATUS_CHANGED_EVENT,
  JOB_APPLICATION_STATUS_ROLLED_BACK_EVENT,
  PLACEMENT_APPLICATION_SUBMITTED_EVENT,
} from "@shared/events/event-constants";

// Re-export placement event interfaces from shared events
// [从共享事件重新导出placement事件接口]
export type {
  IJobApplicationStatusChangedPayload,
  IJobApplicationStatusChangedEvent,
  IJobApplicationStatusRolledBackPayload,
  IJobApplicationStatusRolledBackEvent,
  IPlacementApplicationSubmittedPayload,
  IPlacementApplicationSubmittedEvent,
} from "@shared/events/placement-application.events";
