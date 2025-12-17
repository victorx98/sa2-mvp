/**
 * Meeting Events Catalog
 * 会议事件目录
 *
 * Centralized catalog for all meeting lifecycle events.
 * These events are triggered by meeting providers (Feishu/Zoom) webhooks.
 *
 * 集中管理所有会议生命周期事件的目录。
 * 这些事件由会议提供商（飞书/Zoom）的webhook触发。
 */

import {
  EventCatalogEntry,
  EventDomain,
  EventType,
  ConsumerPriority,
  ErrorHandlingStrategy,
} from "./types";

import {
  MEETING_LIFECYCLE_COMPLETED_EVENT,
  MEETING_RECORDING_READY_EVENT,
  SERVICE_SESSION_COMPLETED_EVENT,
} from "@shared/events/event-constants";

/**
 * Meeting Events Catalog
 * Maps meeting event name constants to their full metadata
 * 会议事件目录 - 将会议事件名称常量映射到完整元数据
 */
export const MeetingEventsCatalog: Record<string, EventCatalogEntry> = {
  // ============================================================
  // Meeting Lifecycle Events (会议生命周期事件)
  // ============================================================

  [MEETING_LIFECYCLE_COMPLETED_EVENT]: {
    name: MEETING_LIFECYCLE_COMPLETED_EVENT,
    description:
      "Meeting physically completed. Triggered by webhook when meeting ends on provider platform.",
    descriptionCN:
      "会议物理结束。当会议在提供商平台上结束时由webhook触发。",
    domain: EventDomain.MEETING,
    eventType: EventType.STATE_CHANGE,
    payloadType: "MeetingLifecycleCompletedPayload",
    producers: ["MeetingLifecycleService.handleMeetingCompleted"],
    consumers: [
      {
        handler: "RegularMentoringEventListener",
        priority: ConsumerPriority.CRITICAL,
        async: false,
        module: "domains/services/sessions/regular-mentoring",
        description:
          "Complete regular mentoring session when its meeting ends",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
      {
        handler: "GapAnalysisEventListener",
        priority: ConsumerPriority.CRITICAL,
        async: false,
        module: "domains/services/sessions/gap-analysis",
        description: "Complete gap analysis session when its meeting ends",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
      {
        handler: "AiCareerEventListener",
        priority: ConsumerPriority.CRITICAL,
        async: false,
        module: "domains/services/sessions/ai-career",
        description: "Complete AI career session when its meeting ends",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
      {
        handler: "CommSessionEventListener",
        priority: ConsumerPriority.CRITICAL,
        async: false,
        module: "domains/services/comm-sessions",
        description: "Complete communication session when its meeting ends",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
      {
        handler: "ClassSessionEventListener",
        priority: ConsumerPriority.CRITICAL,
        async: false,
        module: "domains/services/class/class-sessions",
        description: "Complete class session when its meeting ends",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
      {
        handler: "MeetingCompletedCalendarListener",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "core/calendar",
        description: "Update calendar slots with actual meeting duration",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    triggers: [SERVICE_SESSION_COMPLETED_EVENT],
    tags: ["meeting", "lifecycle", "webhook", "completion"],
    version: "4.1",
  },

  [MEETING_RECORDING_READY_EVENT]: {
    name: MEETING_RECORDING_READY_EVENT,
    description:
      "Meeting recording is ready for download. Triggered when provider processes recording.",
    descriptionCN:
      "会议录制已准备好下载。当提供商处理完录制时触发。",
    domain: EventDomain.MEETING,
    eventType: EventType.STATE_CHANGE,
    payloadType: "MeetingRecordingReadyPayload",
    producers: ["MeetingLifecycleService.handleRecordingReady"],
    consumers: [
      {
        handler: "RecordingStorageService",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "core/meeting",
        description: "Store recording URL in session record",
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
      {
        handler: "NotificationService",
        priority: ConsumerPriority.LOW,
        async: true,
        module: "notification",
        description: "Notify mentor/student that recording is available",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    requires: [MEETING_LIFECYCLE_COMPLETED_EVENT],
    tags: ["meeting", "recording", "webhook"],
    version: "4.1",
  },

  // Internal meeting status change event (not exported in constants but used internally)
  "meeting.status.changed": {
    name: "meeting.status.changed",
    description:
      "Internal event for meeting status transitions. Used for tracking meeting state machine.",
    descriptionCN:
      "内部会议状态转换事件。用于跟踪会议状态机。",
    domain: EventDomain.MEETING,
    eventType: EventType.STATE_CHANGE,
    payloadType: "MeetingStatusChangedPayload",
    producers: ["MeetingLifecycleService"],
    consumers: [
      {
        handler: "MeetingStatusTracker",
        priority: ConsumerPriority.BACKGROUND,
        async: true,
        module: "core/meeting",
        description: "Track meeting status transitions for analytics",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    tags: ["meeting", "internal", "status"],
    version: "4.1",
  },
};

/**
 * Get all meeting event names
 * 获取所有会议事件名称
 */
export const getAllMeetingEventNames = (): string[] => {
  return Object.keys(MeetingEventsCatalog);
};

/**
 * Check if event is a meeting lifecycle event
 * 检查事件是否为会议生命周期事件
 */
export const isMeetingEvent = (eventName: string): boolean => {
  return eventName in MeetingEventsCatalog;
};
