/**
 * Session Booking Flow Definition
 * 会话预约流程定义
 *
 * Defines the complete flow for session creation and booking:
 * 1. Session record created → Meeting creation triggered
 * 2. Meeting created on provider (Feishu/Zoom)
 * 3. Session updated with meeting info
 * 4. Calendar slots updated
 * 5. SESSION_BOOKED event published
 * 6. Notifications sent
 *
 * 定义会话创建和预约的完整流程：
 * 1. 会话记录创建 → 触发会议创建
 * 2. 在提供商（飞书/Zoom）上创建会议
 * 3. 用会议信息更新会话
 * 4. 更新日历槽位
 * 5. 发布SESSION_BOOKED事件
 * 6. 发送通知
 */

import { BusinessFlowDefinition, FlowStep } from "./types";
import { ErrorHandlingStrategy } from "@events/catalog/types";

/**
 * Session Booking Flow
 * Applies to: Regular Mentoring, Gap Analysis, AI Career, Comm Session, Class Session
 * 适用于：常规辅导、Gap分析、AI职业、沟通会话、班课会话
 */
export const SessionBookingFlow: BusinessFlowDefinition = {
  id: "session-booking",
  name: "Session Booking Flow",
  description:
    "Complete flow from session creation to booking confirmation with meeting creation",
  descriptionCN:
    "从会话创建到预约确认的完整流程，包含会议创建",
  version: "2.0",
  domain: "session",
  entryPoint: "{session_type}.session.created",
  terminationEvents: [
    "{session_type}.session.meeting.operation.result",
    "session.booked",
  ],

  steps: [
    // Step 1: Session Created - Entry Point
    {
      id: "session-created",
      name: "Session Created",
      description:
        "Session record created in database, triggers async meeting creation",
      triggerEvent: "{session_type}.session.created",
      handler: "{SessionType}Service.createSession",
      emitsEvents: ["{session_type}.session.created"],
      next: "create-meeting",
      async: true,
    },

    // Step 2: Create Meeting on Provider
    {
      id: "create-meeting",
      name: "Create Meeting",
      description:
        "Create meeting on external provider (Feishu/Zoom) with retry logic",
      triggerEvent: "{session_type}.session.created",
      handler: "{SessionType}CreatedEventHandler.handleSessionCreated",
      emitsEvents: ["session.booked", "{session_type}.session.meeting.operation.result"],
      next: [
        { to: "update-session", condition: "meeting created successfully" },
        { to: "handle-failure", condition: "meeting creation failed" },
      ],
      timeout: 60000, // Meeting creation can take time with retries
      retries: 3,
      onError: ErrorHandlingStrategy.RETRY,
      async: true,
    },

    // Step 3: Update Session with Meeting Info
    {
      id: "update-session",
      name: "Update Session",
      description: "Update session record with meeting ID and URL",
      triggerEvent: "internal",
      handler: "{SessionType}CreatedEventHandler (internal)",
      next: "update-calendar",
    },

    // Step 4: Update Calendar Slots
    {
      id: "update-calendar",
      name: "Update Calendar",
      description: "Update mentor and student calendar slots with meeting URL",
      triggerEvent: "internal",
      handler: "CalendarSlotService.updateSlots",
      next: "publish-booked",
    },

    // Step 5: Publish Session Booked Event
    {
      id: "publish-booked",
      name: "Publish Booked Event",
      description: "Publish SESSION_BOOKED event for downstream processing",
      triggerEvent: "internal",
      handler: "EventEmitter.emit",
      emitsEvents: ["session.booked"],
      next: "publish-result",
    },

    // Step 6: Publish Operation Result
    {
      id: "publish-result",
      name: "Publish Result",
      description: "Publish unified result event with operation=create, status=success",
      triggerEvent: "internal",
      handler: "EventEmitter.emit",
      emitsEvents: ["{session_type}.session.meeting.operation.result"],
      next: "send-notifications",
    },

    // Step 7: Send Notifications
    {
      id: "send-notifications",
      name: "Send Notifications",
      description: "Send booking confirmation to mentor, student, and counselor",
      triggerEvent: "session.booked",
      handler: "NotificationService.sendBookingConfirmation",
      async: true,
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
    },

    // Step X: Handle Failure
    {
      id: "handle-failure",
      name: "Handle Failure",
      description: "Handle meeting creation failure, notify counselor",
      triggerEvent: "meeting.creation.failed",
      handler: "{SessionType}CreatedEventHandler (error handler)",
      emitsEvents: ["{session_type}.session.meeting.operation.result"],
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
    },
  ],

  mermaidDiagram: `
graph TD
    A[Session Created] -->|triggers async| B[Create Meeting]
    B -->|success| C[Update Session]
    B -->|failure| X[Handle Failure]
    C --> D[Update Calendar]
    D --> E[Publish session.booked]
    E --> F[Publish operation.result]
    F --> G[Send Notifications]
    X --> H[Publish operation.result failed]
    H --> I[Notify Counselor]

    subgraph "Session Service"
        A
    end

    subgraph "Event Handler Async"
        B
        C
        D
        E
        F
        X
        H
    end

    subgraph "Notification Service"
        G
        I
    end
  `,

  monitoring: {
    alertOnStepFailure: true,
    maxFlowDuration: 120000, // 2 minutes max
    enableTracing: true,
    metrics: [
      "session_booking_duration",
      "meeting_creation_retries",
      "booking_success_rate",
    ],
  },

  tags: ["session", "booking", "meeting", "critical-path"],
  owner: "service-team",
  lastUpdated: "2024-12-17",
};

/**
 * Session Type specific variations
 * Each session type follows the same flow pattern
 * 每种会话类型遵循相同的流程模式
 */
export const SessionTypeMapping = {
  regular_mentoring: {
    created: "regular_mentoring.session.created",
    updated: "regular_mentoring.session.updated",
    cancelled: "regular_mentoring.session.cancelled",
    result: "regular_mentoring.session.meeting.operation.result",
    handler: "RegularMentoringCreatedEventHandler",
    service: "RegularMentoringService",
  },
  gap_analysis: {
    created: "gap_analysis.session.created",
    updated: "gap_analysis.session.updated",
    cancelled: "gap_analysis.session.cancelled",
    result: "gap_analysis.session.meeting.operation.result",
    handler: "GapAnalysisCreatedEventHandler",
    service: "GapAnalysisService",
  },
  ai_career: {
    created: "ai_career.session.created",
    updated: "ai_career.session.updated",
    cancelled: "ai_career.session.cancelled",
    result: "ai_career.session.meeting.operation.result",
    handler: "AiCareerCreatedEventHandler",
    service: "AiCareerService",
  },
  comm_session: {
    created: "comm_session.session.created",
    updated: "comm_session.session.updated",
    cancelled: "comm_session.session.cancelled",
    result: "comm_session.session.meeting.operation.result",
    handler: "CommSessionCreatedEventHandler",
    service: "CommSessionService",
  },
  class_session: {
    created: "class_session.session.created",
    updated: "class_session.session.updated",
    cancelled: "class_session.session.cancelled",
    result: "class_session.session.meeting.operation.result",
    handler: "ClassSessionCreatedEventHandler",
    service: "ClassSessionService",
  },
};
