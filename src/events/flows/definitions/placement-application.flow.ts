/**
 * Placement Application Flow Definition
 * 就业申请流程定义
 *
 * Defines the complete flow for job application status changes:
 * 1. Application status changes
 * 2. Service consumption recorded based on milestone
 * 3. Entitlement consumed in financial domain
 * 4. Notifications sent
 *
 * 定义工作申请状态变更的完整流程：
 * 1. 申请状态变更
 * 2. 根据里程碑记录服务消耗
 * 3. 在财务域消耗权益
 * 4. 发送通知
 */

import { BusinessFlowDefinition } from "./types";
import { ErrorHandlingStrategy } from "@events/catalog/types";

/**
 * Placement Application Flow
 * Tracks job application status changes and billing
 * 跟踪工作申请状态变更和计费
 */
export const PlacementApplicationFlow: BusinessFlowDefinition = {
  id: "placement-application",
  name: "Placement Application Flow",
  description:
    "Complete flow for job application status changes, consumption recording, and billing",
  descriptionCN:
    "工作申请状态变更、消耗记录和计费的完整流程",
  version: "1.0",
  domain: "placement",
  entryPoint: "placement.application.status_changed",
  terminationEvents: [
    "placement.application.status_changed",
    "placement.application.submitted",
  ],

  steps: [
    // Step 1: Application Status Changed - Entry Point
    {
      id: "status-changed",
      name: "Status Changed",
      description:
        "Job application status changed (e.g., submitted, interview scheduled, offer received)",
      triggerEvent: "placement.application.status_changed",
      handler: "JobApplicationService.updateApplicationStatus",
      emitsEvents: [
        "placement.application.status_changed",
        "placement.application.submitted",
      ],
      next: "record-contract-consumption",
      async: false,
    },

    // Step 2: Record Contract Consumption
    {
      id: "record-contract-consumption",
      name: "Record Contract Consumption",
      description:
        "Record placement application consumption in service ledger based on status transition",
      triggerEvent: "placement.application.status_changed",
      handler: "PlacementEventListener (Contract)",
      next: "record-financial-consumption",
      onError: ErrorHandlingStrategy.FAIL_FAST,
      async: false,
    },

    // Step 3: Record Financial Consumption
    {
      id: "record-financial-consumption",
      name: "Record Financial Consumption",
      description: "Record entitlement consumption for placement services",
      triggerEvent: "placement.application.status_changed",
      handler: "PlacementApplicationStatusChangedListener (Financial)",
      next: "check-submission",
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      async: false,
    },

    // Step 4: Check if Submission (first status change)
    {
      id: "check-submission",
      name: "Check Submission",
      description: "Check if this is the first status change (submission)",
      triggerEvent: "internal",
      handler: "JobApplicationService",
      next: [
        { to: "notify-submission", condition: "is first submission" },
        { to: "end", condition: "not first submission" },
      ],
    },

    // Step 5: Notify Submission
    {
      id: "notify-submission",
      name: "Notify Submission",
      description: "Notify counselor/student of application submission",
      triggerEvent: "placement.application.submitted",
      handler: "NotificationService",
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      async: true,
    },

    // End node (implicit)
    {
      id: "end",
      name: "End",
      description: "Flow completed",
      triggerEvent: "internal",
      handler: "none",
    },
  ],

  mermaidDiagram: `
graph TD
    A[Application Status Changed] -->|placement.application.status_changed| B[Contract Domain]
    B -->|PlacementEventListener| C[Record Ledger Consumption]
    A -->|placement.application.status_changed| D[Financial Domain]
    D -->|PlacementStatusChangedListener| E[Record Entitlement Consumption]
    A -->|if first submission| F[placement.application.submitted]
    F --> G[Notify Counselor/Student]

    subgraph "Job Application Service"
        A
    end

    subgraph "Contract Domain"
        B
        C
    end

    subgraph "Financial Domain"
        D
        E
    end

    subgraph "Notification"
        F
        G
    end
  `,

  monitoring: {
    alertOnStepFailure: true,
    maxFlowDuration: 15000, // 15 seconds
    enableTracing: true,
    metrics: [
      "placement_status_changes",
      "entitlement_consumption",
      "submission_count",
    ],
  },

  tags: ["placement", "application", "billing", "consumption"],
  owner: "placement-team",
  lastUpdated: "2024-12-17",
};

/**
 * Placement Status Rollback Flow
 * Handles reversal of status changes
 * 处理状态变更的冲销
 */
export const PlacementRollbackFlow: BusinessFlowDefinition = {
  id: "placement-rollback",
  name: "Placement Status Rollback Flow",
  description: "Handle rollback of job application status changes with refunds",
  descriptionCN: "处理工作申请状态变更的回滚和退款",
  version: "1.0",
  domain: "placement",
  entryPoint: "placement.application.status_rolled_back",
  terminationEvents: ["placement.application.status_rolled_back"],

  steps: [
    {
      id: "status-rolled-back",
      name: "Status Rolled Back",
      description: "Job application status rolled back to previous state",
      triggerEvent: "placement.application.status_rolled_back",
      handler: "JobApplicationService.rollbackApplicationStatus",
      emitsEvents: ["placement.application.status_rolled_back"],
      next: "reverse-contract-consumption",
      async: false,
    },
    {
      id: "reverse-contract-consumption",
      name: "Reverse Contract Consumption",
      description: "Reverse placement application consumption in service ledger",
      triggerEvent: "placement.application.status_rolled_back",
      handler: "PlacementEventListener (Contract)",
      next: "refund-entitlement",
      onError: ErrorHandlingStrategy.FAIL_FAST,
      async: false,
    },
    {
      id: "refund-entitlement",
      name: "Refund Entitlement",
      description: "Refund entitlement consumption on rollback",
      triggerEvent: "placement.application.status_rolled_back",
      handler: "PlacementApplicationStatusRolledBackListener (Financial)",
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      async: false,
    },
  ],

  mermaidDiagram: `
graph TD
    A[Status Rolled Back] -->|placement.application.status_rolled_back| B[Contract Domain]
    B --> C[Reverse Ledger Consumption]
    A -->|placement.application.status_rolled_back| D[Financial Domain]
    D --> E[Refund Entitlement]
  `,

  monitoring: {
    alertOnStepFailure: true,
    maxFlowDuration: 15000,
  },

  tags: ["placement", "rollback", "refund"],
  owner: "placement-team",
  lastUpdated: "2024-12-17",
};
