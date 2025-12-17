/**
 * Session Events Catalog
 * 会话事件目录
 *
 * Centralized catalog for all session-related events including:
 * - Regular Mentoring Sessions
 * - Gap Analysis Sessions
 * - AI Career Sessions
 * - Communication Sessions
 * - Class Sessions
 * - Generic Session Events
 *
 * 集中管理所有会话相关事件的目录，包括：
 * - 常规辅导会话
 * - Gap分析会话
 * - AI职业会话
 * - 沟通会话
 * - 班课会话
 * - 通用会话事件
 */

import {
  EventCatalogEntry,
  EventDomain,
  EventType,
  ConsumerPriority,
  ErrorHandlingStrategy,
} from "./types";

// Import event constants
import {
  SESSION_BOOKED_EVENT,
  SESSION_CREATED_EVENT,
  SESSION_RESCHEDULED_COMPLETED,
  SERVICE_SESSION_COMPLETED_EVENT,
  REGULAR_MENTORING_SESSION_CREATED_EVENT,
  REGULAR_MENTORING_SESSION_UPDATED_EVENT,
  REGULAR_MENTORING_SESSION_CANCELLED_EVENT,
  REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT,
  GAP_ANALYSIS_SESSION_CREATED_EVENT,
  GAP_ANALYSIS_SESSION_UPDATED_EVENT,
  GAP_ANALYSIS_SESSION_CANCELLED_EVENT,
  GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT,
  AI_CAREER_SESSION_CREATED_EVENT,
  AI_CAREER_SESSION_UPDATED_EVENT,
  AI_CAREER_SESSION_CANCELLED_EVENT,
  AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT,
  COMM_SESSION_CREATED_EVENT,
  COMM_SESSION_UPDATED_EVENT,
  COMM_SESSION_CANCELLED_EVENT,
  COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
  CLASS_SESSION_CREATED_EVENT,
  CLASS_SESSION_UPDATED_EVENT,
  CLASS_SESSION_CANCELLED_EVENT,
  CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT,
} from "@shared/events/event-constants";

/**
 * Session Events Catalog
 * Maps event name constants to their full metadata
 * 会话事件目录 - 将事件名称常量映射到完整元数据
 */
export const SessionEventsCatalog: Record<string, EventCatalogEntry> = {
  // ============================================================
  // Generic Session Events (通用会话事件)
  // ============================================================

  [SESSION_BOOKED_EVENT]: {
    name: SESSION_BOOKED_EVENT,
    description:
      "Session successfully booked with meeting created. Published after meeting creation completes.",
    descriptionCN:
      "会话成功预约且会议已创建。在会议创建完成后发布。",
    domain: EventDomain.SESSION,
    eventType: EventType.RESULT,
    payloadType: "SessionBookedEvent",
    producers: [
      "RegularMentoringCreatedEventHandler",
      "GapAnalysisCreatedEventHandler",
      "AiCareerCreatedEventHandler",
      "CommSessionCreatedEventHandler",
      "ClassSessionCreatedEventHandler",
      "BookSessionCommand",
    ],
    consumers: [
      {
        handler: "NotificationService",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "notification",
        description: "Send booking confirmation to all parties",
      },
    ],
    triggers: [],
    tags: ["session", "booking", "notification"],
    version: "1.0",
  },

  [SESSION_CREATED_EVENT]: {
    name: SESSION_CREATED_EVENT,
    description:
      "Legacy event for session creation. Used for backward compatibility with Contract Domain.",
    descriptionCN:
      "遗留的会话创建事件。用于与合同域的向后兼容。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "SessionCreatedEvent",
    producers: ["BookSessionCommand"],
    consumers: [],
    deprecated: true,
    deprecationMessage: "Use type-specific session created events instead",
    tags: ["session", "legacy"],
    version: "1.0",
  },

  [SESSION_RESCHEDULED_COMPLETED]: {
    name: SESSION_RESCHEDULED_COMPLETED,
    description:
      "Session rescheduling completed. Triggers notifications for time/metadata changes.",
    descriptionCN:
      "会话改期完成。触发时间/元数据变更通知。",
    domain: EventDomain.SESSION,
    eventType: EventType.RESULT,
    payloadType: "SessionRescheduledEvent",
    producers: [
      "RegularMentoringEventHandler",
      "GapAnalysisService",
      "AiCareerService",
      "CommSessionEventHandler",
    ],
    consumers: [
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Send reschedule notification to participants",
      },
    ],
    deprecated: true,
    deprecationMessage:
      "Use type-specific MEETING_OPERATION_RESULT events instead",
    tags: ["session", "reschedule", "legacy"],
    version: "1.0",
  },

  [SERVICE_SESSION_COMPLETED_EVENT]: {
    name: SERVICE_SESSION_COMPLETED_EVENT,
    description:
      "Service session completed. Published when meeting ends and session status updated to COMPLETED.",
    descriptionCN:
      "服务会话完成。当会议结束且会话状态更新为已完成时发布。",
    domain: EventDomain.SESSION,
    eventType: EventType.STATE_CHANGE,
    payloadType: "IServiceSessionCompletedEvent",
    producers: [
      "RegularMentoringService",
      "GapAnalysisService",
      "AiCareerService",
      "CommSessionService",
      "ClassSessionService",
    ],
    consumers: [
      {
        handler: "SessionCompletedListener",
        priority: ConsumerPriority.CRITICAL,
        async: false,
        module: "contract",
        description: "Release service hold and record consumption in ledger",
        errorStrategy: ErrorHandlingStrategy.FAIL_FAST,
      },
      {
        handler: "FinancialSessionCompletedListener",
        priority: ConsumerPriority.HIGH,
        async: false,
        module: "financial",
        description: "Release financial hold and record consumption",
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    triggers: [],
    requires: [
      "meeting.lifecycle.completed", // Must have meeting completed first
    ],
    tags: ["session", "completion", "billing", "ledger"],
    version: "1.0",
  },

  // ============================================================
  // Regular Mentoring Session Events (常规辅导会话事件)
  // ============================================================

  [REGULAR_MENTORING_SESSION_CREATED_EVENT]: {
    name: REGULAR_MENTORING_SESSION_CREATED_EVENT,
    description:
      "Regular mentoring session record created. Triggers async meeting creation.",
    descriptionCN:
      "常规辅导会话记录已创建。触发异步会议创建。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "RegularMentoringSessionCreatedEvent",
    producers: ["RegularMentoringService.createSession"],
    consumers: [
      {
        handler: "RegularMentoringCreatedEventHandler",
        priority: ConsumerPriority.CRITICAL,
        async: true,
        module: "application/commands/services",
        description:
          "Create meeting on Feishu/Zoom, update session with meeting info",
        timeout: 60000, // Meeting creation can take up to 60s with retries
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    triggers: [
      SESSION_BOOKED_EVENT,
      REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT,
    ],
    tags: ["session", "regular-mentoring", "meeting-creation"],
    version: "2.0",
  },

  [REGULAR_MENTORING_SESSION_UPDATED_EVENT]: {
    name: REGULAR_MENTORING_SESSION_UPDATED_EVENT,
    description:
      "Regular mentoring session updated (time/duration change). Triggers async meeting update.",
    descriptionCN:
      "常规辅导会话已更新（时间/时长变更）。触发异步会议更新。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "RegularMentoringSessionUpdatedEvent",
    producers: ["RegularMentoringService.updateSession"],
    consumers: [
      {
        handler: "RegularMentoringEventHandler.handleSessionUpdated",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application/commands/services",
        description: "Update meeting time on provider, update calendar slots",
        timeout: 30000,
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    triggers: [
      SESSION_RESCHEDULED_COMPLETED,
      REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT,
    ],
    tags: ["session", "regular-mentoring", "update"],
    version: "2.0",
  },

  [REGULAR_MENTORING_SESSION_CANCELLED_EVENT]: {
    name: REGULAR_MENTORING_SESSION_CANCELLED_EVENT,
    description:
      "Regular mentoring session cancelled. Triggers async meeting cancellation.",
    descriptionCN:
      "常规辅导会话已取消。触发异步会议取消。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "RegularMentoringSessionCancelledEvent",
    producers: ["RegularMentoringService.cancelSession"],
    consumers: [
      {
        handler: "RegularMentoringEventHandler.handleSessionCancelled",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application/commands/services",
        description: "Cancel meeting on provider, release calendar slots",
        timeout: 30000,
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    triggers: [REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT],
    tags: ["session", "regular-mentoring", "cancellation"],
    version: "2.0",
  },

  [REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT]: {
    name: REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT,
    description:
      "Unified result event for meeting operations (create/update/cancel). Contains operation type and success/failed status.",
    descriptionCN:
      "会议操作的统一结果事件（创建/更新/取消）。包含操作类型和成功/失败状态。",
    domain: EventDomain.SESSION,
    eventType: EventType.RESULT,
    payloadType: "MeetingOperationResultEvent",
    producers: [
      "RegularMentoringCreatedEventHandler",
      "RegularMentoringEventHandler",
    ],
    consumers: [
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify parties of operation result",
      },
    ],
    requires: [
      REGULAR_MENTORING_SESSION_CREATED_EVENT,
      REGULAR_MENTORING_SESSION_UPDATED_EVENT,
      REGULAR_MENTORING_SESSION_CANCELLED_EVENT,
    ],
    tags: ["session", "regular-mentoring", "result", "notification"],
    version: "2.0",
  },

  // ============================================================
  // Gap Analysis Session Events (Gap分析会话事件)
  // ============================================================

  [GAP_ANALYSIS_SESSION_CREATED_EVENT]: {
    name: GAP_ANALYSIS_SESSION_CREATED_EVENT,
    description:
      "Gap analysis session record created. Triggers async meeting creation.",
    descriptionCN:
      "Gap分析会话记录已创建。触发异步会议创建。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "GapAnalysisSessionCreatedEvent",
    producers: ["GapAnalysisService.createSession"],
    consumers: [
      {
        handler: "GapAnalysisCreatedEventHandler",
        priority: ConsumerPriority.CRITICAL,
        async: true,
        module: "application/commands/services",
        description:
          "Create meeting on Feishu/Zoom, update session with meeting info",
        timeout: 60000,
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    triggers: [
      SESSION_BOOKED_EVENT,
      GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT,
    ],
    tags: ["session", "gap-analysis", "meeting-creation"],
    version: "2.0",
  },

  [GAP_ANALYSIS_SESSION_UPDATED_EVENT]: {
    name: GAP_ANALYSIS_SESSION_UPDATED_EVENT,
    description:
      "Gap analysis session updated. Triggers async meeting update.",
    descriptionCN:
      "Gap分析会话已更新。触发异步会议更新。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "GapAnalysisSessionUpdatedEvent",
    producers: ["GapAnalysisService.updateSession"],
    consumers: [
      {
        handler: "GapAnalysisEventHandler.handleSessionUpdated",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application/commands/services",
        description: "Update meeting time on provider",
        timeout: 30000,
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    triggers: [
      SESSION_RESCHEDULED_COMPLETED,
      GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT,
    ],
    tags: ["session", "gap-analysis", "update"],
    version: "2.0",
  },

  [GAP_ANALYSIS_SESSION_CANCELLED_EVENT]: {
    name: GAP_ANALYSIS_SESSION_CANCELLED_EVENT,
    description:
      "Gap analysis session cancelled. Triggers async meeting cancellation.",
    descriptionCN:
      "Gap分析会话已取消。触发异步会议取消。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "GapAnalysisSessionCancelledEvent",
    producers: ["GapAnalysisService.cancelSession"],
    consumers: [
      {
        handler: "GapAnalysisEventHandler.handleSessionCancelled",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application/commands/services",
        description: "Cancel meeting on provider",
        timeout: 30000,
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    triggers: [GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT],
    tags: ["session", "gap-analysis", "cancellation"],
    version: "2.0",
  },

  [GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT]: {
    name: GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT,
    description:
      "Unified result event for Gap Analysis meeting operations.",
    descriptionCN:
      "Gap分析会议操作的统一结果事件。",
    domain: EventDomain.SESSION,
    eventType: EventType.RESULT,
    payloadType: "MeetingOperationResultEvent",
    producers: ["GapAnalysisCreatedEventHandler", "GapAnalysisEventHandler"],
    consumers: [
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify parties of operation result",
      },
    ],
    tags: ["session", "gap-analysis", "result", "notification"],
    version: "2.0",
  },

  // ============================================================
  // AI Career Session Events (AI职业会话事件)
  // ============================================================

  [AI_CAREER_SESSION_CREATED_EVENT]: {
    name: AI_CAREER_SESSION_CREATED_EVENT,
    description:
      "AI Career session record created. Triggers async meeting creation.",
    descriptionCN:
      "AI职业会话记录已创建。触发异步会议创建。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "AiCareerSessionCreatedEvent",
    producers: ["AiCareerService.createSession"],
    consumers: [
      {
        handler: "AiCareerCreatedEventHandler",
        priority: ConsumerPriority.CRITICAL,
        async: true,
        module: "application/commands/services",
        description:
          "Create meeting on Feishu/Zoom, update session with meeting info",
        timeout: 60000,
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    triggers: [
      SESSION_BOOKED_EVENT,
      AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT,
    ],
    tags: ["session", "ai-career", "meeting-creation"],
    version: "2.0",
  },

  [AI_CAREER_SESSION_UPDATED_EVENT]: {
    name: AI_CAREER_SESSION_UPDATED_EVENT,
    description:
      "AI Career session updated. Triggers async meeting update.",
    descriptionCN:
      "AI职业会话已更新。触发异步会议更新。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "AiCareerSessionUpdatedEvent",
    producers: ["AiCareerService.updateSession"],
    consumers: [
      {
        handler: "AiCareerEventHandler.handleSessionUpdated",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application/commands/services",
        description: "Update meeting time on provider",
        timeout: 30000,
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    triggers: [
      SESSION_RESCHEDULED_COMPLETED,
      AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT,
    ],
    tags: ["session", "ai-career", "update"],
    version: "2.0",
  },

  [AI_CAREER_SESSION_CANCELLED_EVENT]: {
    name: AI_CAREER_SESSION_CANCELLED_EVENT,
    description:
      "AI Career session cancelled. Triggers async meeting cancellation.",
    descriptionCN:
      "AI职业会话已取消。触发异步会议取消。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "AiCareerSessionCancelledEvent",
    producers: ["AiCareerService.cancelSession"],
    consumers: [
      {
        handler: "AiCareerEventHandler.handleSessionCancelled",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application/commands/services",
        description: "Cancel meeting on provider",
        timeout: 30000,
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    triggers: [AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT],
    tags: ["session", "ai-career", "cancellation"],
    version: "2.0",
  },

  [AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT]: {
    name: AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT,
    description:
      "Unified result event for AI Career meeting operations.",
    descriptionCN:
      "AI职业会议操作的统一结果事件。",
    domain: EventDomain.SESSION,
    eventType: EventType.RESULT,
    payloadType: "MeetingOperationResultEvent",
    producers: ["AiCareerCreatedEventHandler", "AiCareerEventHandler"],
    consumers: [
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify parties of operation result",
      },
    ],
    tags: ["session", "ai-career", "result", "notification"],
    version: "2.0",
  },

  // ============================================================
  // Communication Session Events (沟通会话事件)
  // ============================================================

  [COMM_SESSION_CREATED_EVENT]: {
    name: COMM_SESSION_CREATED_EVENT,
    description:
      "Communication session record created. Triggers async meeting creation.",
    descriptionCN:
      "沟通会话记录已创建。触发异步会议创建。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "CommSessionCreatedEvent",
    producers: ["CommSessionService.createSession"],
    consumers: [
      {
        handler: "CommSessionCreatedEventHandler",
        priority: ConsumerPriority.CRITICAL,
        async: true,
        module: "application/commands/services",
        description:
          "Create meeting on Feishu/Zoom, update session with meeting info",
        timeout: 60000,
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    triggers: [
      SESSION_BOOKED_EVENT,
      COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
    ],
    tags: ["session", "comm-session", "meeting-creation"],
    version: "2.0",
  },

  [COMM_SESSION_UPDATED_EVENT]: {
    name: COMM_SESSION_UPDATED_EVENT,
    description:
      "Communication session updated. Triggers async meeting update.",
    descriptionCN:
      "沟通会话已更新。触发异步会议更新。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "CommSessionUpdatedEvent",
    producers: ["CommSessionService.updateSession"],
    consumers: [
      {
        handler: "CommSessionEventHandler.handleSessionUpdated",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application/commands/services",
        description: "Update meeting time on provider",
        timeout: 30000,
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    triggers: [
      SESSION_RESCHEDULED_COMPLETED,
      COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
    ],
    tags: ["session", "comm-session", "update"],
    version: "2.0",
  },

  [COMM_SESSION_CANCELLED_EVENT]: {
    name: COMM_SESSION_CANCELLED_EVENT,
    description:
      "Communication session cancelled. Triggers async meeting cancellation.",
    descriptionCN:
      "沟通会话已取消。触发异步会议取消。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "CommSessionCancelledEvent",
    producers: ["CommSessionService.cancelSession"],
    consumers: [
      {
        handler: "CommSessionEventHandler.handleSessionCancelled",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application/commands/services",
        description: "Cancel meeting on provider",
        timeout: 30000,
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    triggers: [COMM_SESSION_MEETING_OPERATION_RESULT_EVENT],
    tags: ["session", "comm-session", "cancellation"],
    version: "2.0",
  },

  [COMM_SESSION_MEETING_OPERATION_RESULT_EVENT]: {
    name: COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
    description:
      "Unified result event for Communication session meeting operations.",
    descriptionCN:
      "沟通会话会议操作的统一结果事件。",
    domain: EventDomain.SESSION,
    eventType: EventType.RESULT,
    payloadType: "MeetingOperationResultEvent",
    producers: ["CommSessionCreatedEventHandler", "CommSessionEventHandler"],
    consumers: [
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify parties of operation result",
      },
    ],
    tags: ["session", "comm-session", "result", "notification"],
    version: "2.0",
  },

  // ============================================================
  // Class Session Events (班课会话事件)
  // ============================================================

  [CLASS_SESSION_CREATED_EVENT]: {
    name: CLASS_SESSION_CREATED_EVENT,
    description:
      "Class session record created. Triggers async meeting creation.",
    descriptionCN:
      "班课会话记录已创建。触发异步会议创建。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "ClassSessionCreatedEvent",
    producers: ["ClassSessionService.createSession"],
    consumers: [
      {
        handler: "ClassSessionCreatedEventHandler",
        priority: ConsumerPriority.CRITICAL,
        async: true,
        module: "application/commands/services",
        description:
          "Create meeting on Feishu/Zoom, update session with meeting info",
        timeout: 60000,
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    triggers: [
      SESSION_BOOKED_EVENT,
      CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT,
    ],
    tags: ["session", "class-session", "meeting-creation"],
    version: "2.0",
  },

  [CLASS_SESSION_UPDATED_EVENT]: {
    name: CLASS_SESSION_UPDATED_EVENT,
    description: "Class session updated. Triggers async meeting update.",
    descriptionCN:
      "班课会话已更新。触发异步会议更新。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "ClassSessionUpdatedEvent",
    producers: ["ClassSessionService.updateSession"],
    consumers: [
      {
        handler: "ClassSessionEventHandler.handleSessionUpdated",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application/commands/services",
        description: "Update meeting time on provider",
        timeout: 30000,
        errorStrategy: ErrorHandlingStrategy.RETRY,
      },
    ],
    triggers: [CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT],
    tags: ["session", "class-session", "update"],
    version: "2.0",
  },

  [CLASS_SESSION_CANCELLED_EVENT]: {
    name: CLASS_SESSION_CANCELLED_EVENT,
    description:
      "Class session cancelled. Triggers async meeting cancellation.",
    descriptionCN:
      "班课会话已取消。触发异步会议取消。",
    domain: EventDomain.SESSION,
    eventType: EventType.TRIGGER,
    payloadType: "ClassSessionCancelledEvent",
    producers: ["ClassSessionService.cancelSession"],
    consumers: [
      {
        handler: "ClassSessionEventHandler.handleSessionCancelled",
        priority: ConsumerPriority.HIGH,
        async: true,
        module: "application/commands/services",
        description: "Cancel meeting on provider",
        timeout: 30000,
        errorStrategy: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      },
    ],
    triggers: [CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT],
    tags: ["session", "class-session", "cancellation"],
    version: "2.0",
  },

  [CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT]: {
    name: CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT,
    description:
      "Unified result event for Class session meeting operations.",
    descriptionCN:
      "班课会话会议操作的统一结果事件。",
    domain: EventDomain.SESSION,
    eventType: EventType.RESULT,
    payloadType: "MeetingOperationResultEvent",
    producers: [
      "ClassSessionCreatedEventHandler",
      "ClassSessionEventHandler",
    ],
    consumers: [
      {
        handler: "NotificationService",
        priority: ConsumerPriority.NORMAL,
        async: true,
        module: "notification",
        description: "Notify parties of operation result",
      },
    ],
    tags: ["session", "class-session", "result", "notification"],
    version: "2.0",
  },
};

/**
 * Get all session event names
 * 获取所有会话事件名称
 */
export const getAllSessionEventNames = (): string[] => {
  return Object.keys(SessionEventsCatalog);
};

/**
 * Get session events by tag
 * 按标签获取会话事件
 */
export const getSessionEventsByTag = (tag: string): EventCatalogEntry[] => {
  return Object.values(SessionEventsCatalog).filter(
    (entry) => entry.tags?.includes(tag),
  );
};

/**
 * Get session events by type
 * 按事件类型获取会话事件
 */
export const getSessionEventsByType = (
  eventType: EventType,
): EventCatalogEntry[] => {
  return Object.values(SessionEventsCatalog).filter(
    (entry) => entry.eventType === eventType,
  );
};
