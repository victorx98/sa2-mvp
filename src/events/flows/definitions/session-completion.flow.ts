/**
 * Session Completion Flow Definition
 * 会话完成流程定义
 *
 * Defines the complete flow when a meeting ends and session is completed:
 * 1. Meeting lifecycle completed (webhook from provider)
 * 2. Session status updated to COMPLETED
 * 3. SERVICE_SESSION_COMPLETED event published
 * 4. Service hold released
 * 5. Consumption recorded in service ledger
 * 6. Financial tracking updated
 *
 * 定义会议结束和会话完成时的完整流程：
 * 1. 会议生命周期完成（来自提供商的webhook）
 * 2. 会话状态更新为已完成
 * 3. 发布SERVICE_SESSION_COMPLETED事件
 * 4. 释放服务预留
 * 5. 在服务账本中记录消耗
 * 6. 更新财务追踪
 */

import { BusinessFlowDefinition } from "./types";
import { ErrorHandlingStrategy } from "@events/catalog/types";

/**
 * Session Completion Flow
 * Triggered by meeting.lifecycle.completed webhook
 * 由meeting.lifecycle.completed webhook触发
 */
export const SessionCompletionFlow: BusinessFlowDefinition = {
  id: "session-completion",
  name: "Session Completion Flow",
  description:
    "Complete flow from meeting end to service consumption recording and billing",
  descriptionCN:
    "从会议结束到服务消耗记录和计费的完整流程",
  version: "1.0",
  domain: "session",
  entryPoint: "meeting.lifecycle.completed",
  terminationEvents: ["services.session.completed"],

  steps: [
    // Step 1: Meeting Lifecycle Completed - Entry Point (from webhook)
    {
      id: "meeting-completed",
      name: "Meeting Completed",
      description:
        "Meeting physically ended on provider platform, received via webhook",
      triggerEvent: "meeting.lifecycle.completed",
      handler: "MeetingLifecycleService.handleMeetingCompleted",
      emitsEvents: ["meeting.lifecycle.completed"],
      next: "complete-session",
      async: false,
    },

    // Step 2: Complete Session (Session Type Listeners)
    {
      id: "complete-session",
      name: "Complete Session",
      description:
        "Each session type listener updates its session status to COMPLETED",
      triggerEvent: "meeting.lifecycle.completed",
      handler: "{SessionType}EventListener.handleMeetingCompletion",
      emitsEvents: ["services.session.completed"],
      next: "release-service-hold",
      async: false,
    },

    // Step 3: Release Service Hold (Contract Domain)
    {
      id: "release-service-hold",
      name: "Release Service Hold",
      description:
        "Release the service hold and record consumption in service ledger",
      triggerEvent: "services.session.completed",
      handler: "SessionCompletedListener (Contract)",
      next: "record-consumption",
      onError: ErrorHandlingStrategy.FAIL_FAST,
      async: false,
    },

    // Step 4: Record Consumption
    {
      id: "record-consumption",
      name: "Record Consumption",
      description: "Record service consumption in the service ledger",
      triggerEvent: "internal",
      handler: "ServiceLedgerService.recordConsumption",
      next: "update-financial",
      onError: ErrorHandlingStrategy.FAIL_FAST,
      async: false,
    },

    // Step 5: Update Financial Tracking
    {
      id: "update-financial",
      name: "Update Financial",
      description:
        "Release financial hold and record consumption for billing",
      triggerEvent: "services.session.completed",
      handler: "FinancialSessionCompletedListener",
      next: "update-calendar",
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      async: false,
    },

    // Step 6: Update Calendar
    {
      id: "update-calendar",
      name: "Update Calendar",
      description: "Update calendar slots with actual meeting duration",
      triggerEvent: "meeting.lifecycle.completed",
      handler: "MeetingCompletedCalendarListener",
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      async: true,
    },
  ],

  mermaidDiagram: `
graph TD
    A[Webhook: Meeting Ended] -->|meeting.lifecycle.completed| B[MeetingLifecycleService]
    B --> C{Session Type Listeners}
    C -->|Regular Mentoring| D1[RegularMentoringEventListener]
    C -->|Gap Analysis| D2[GapAnalysisEventListener]
    C -->|AI Career| D3[AiCareerEventListener]
    C -->|Comm Session| D4[CommSessionEventListener]
    C -->|Class Session| D5[ClassSessionEventListener]
    D1 & D2 & D3 & D4 & D5 -->|services.session.completed| E[Contract Domain]
    E -->|SessionCompletedListener| F[Release Service Hold]
    F --> G[Record Consumption in Ledger]
    E -->|services.session.completed| H[Financial Domain]
    H -->|FinancialSessionCompletedListener| I[Release Financial Hold]
    I --> J[Record Financial Consumption]
    B -->|meeting.lifecycle.completed| K[Calendar Domain]
    K --> L[Update Slot Duration]

    subgraph "Meeting Webhook"
        A
        B
    end

    subgraph "Session Domains"
        C
        D1
        D2
        D3
        D4
        D5
    end

    subgraph "Contract Domain"
        E
        F
        G
    end

    subgraph "Financial Domain"
        H
        I
        J
    end

    subgraph "Calendar Domain"
        K
        L
    end
  `,

  monitoring: {
    alertOnStepFailure: true,
    maxFlowDuration: 30000, // 30 seconds
    enableTracing: true,
    metrics: [
      "session_completion_duration",
      "service_consumption_recorded",
      "financial_hold_released",
    ],
  },

  tags: ["session", "completion", "billing", "ledger", "critical-path"],
  owner: "service-team",
  lastUpdated: "2024-12-17",
};

/**
 * Session Recording Flow
 * Sub-flow triggered when recording becomes available
 * 录制可用时触发的子流程
 */
export const SessionRecordingFlow: BusinessFlowDefinition = {
  id: "session-recording",
  name: "Session Recording Flow",
  description: "Handle meeting recording availability after session ends",
  descriptionCN: "处理会话结束后的会议录制可用性",
  version: "1.0",
  domain: "session",
  entryPoint: "meeting.recording.ready",
  terminationEvents: ["meeting.recording.ready"],

  steps: [
    {
      id: "recording-ready",
      name: "Recording Ready",
      description: "Recording is processed and available for download",
      triggerEvent: "meeting.recording.ready",
      handler: "MeetingLifecycleService",
      emitsEvents: ["meeting.recording.ready"],
      next: "store-recording-url",
      async: true,
    },
    {
      id: "store-recording-url",
      name: "Store Recording URL",
      description: "Store recording URL in session record",
      triggerEvent: "meeting.recording.ready",
      handler: "RecordingStorageService",
      next: "notify-recording",
      onError: ErrorHandlingStrategy.RETRY,
      async: true,
    },
    {
      id: "notify-recording",
      name: "Notify Recording",
      description: "Notify mentor/student that recording is available",
      triggerEvent: "internal",
      handler: "NotificationService",
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      async: true,
    },
  ],

  mermaidDiagram: `
graph TD
    A[Webhook: Recording Ready] -->|meeting.recording.ready| B[Store Recording URL]
    B --> C[Notify Mentor/Student]
  `,

  monitoring: {
    alertOnStepFailure: false,
    maxFlowDuration: 60000,
  },

  tags: ["session", "recording", "async"],
  owner: "service-team",
  lastUpdated: "2024-12-17",
};
