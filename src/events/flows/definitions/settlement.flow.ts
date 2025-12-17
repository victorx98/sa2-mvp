/**
 * Settlement and Appeal Flow Definitions
 * 结算和申诉流程定义
 *
 * Defines flows for financial settlement and mentor appeals:
 * - Settlement confirmation flow
 * - Appeal creation and resolution flow
 *
 * 定义财务结算和导师申诉的流程：
 * - 结算确认流程
 * - 申诉创建和解决流程
 */

import { BusinessFlowDefinition } from "./types";
import { ErrorHandlingStrategy } from "@events/catalog/types";

/**
 * Settlement Confirmation Flow
 * 结算确认流程
 */
export const SettlementFlow: BusinessFlowDefinition = {
  id: "settlement-confirmation",
  name: "Settlement Confirmation Flow",
  description:
    "Flow for confirming mentor settlements and updating payment parameters",
  descriptionCN:
    "确认导师结算并更新付款参数的流程",
  version: "1.0",
  domain: "financial",
  entryPoint: "financial.settlement.confirmed",
  terminationEvents: ["financial.settlement.confirmed"],

  steps: [
    // Step 1: Settlement Confirmed - Entry Point
    {
      id: "settlement-confirmed",
      name: "Settlement Confirmed",
      description:
        "Settlement record created and confirmed for a mentor's monthly earnings",
      triggerEvent: "financial.settlement.confirmed",
      handler: "SettlementService.confirmSettlement",
      emitsEvents: ["financial.settlement.confirmed"],
      next: "update-payment-params",
      async: true,
    },

    // Step 2: Update Payment Parameters
    {
      id: "update-payment-params",
      name: "Update Payment Parameters",
      description:
        "Update mentor payment parameters (exchange rate, deduction rate, settlement method)",
      triggerEvent: "financial.settlement.confirmed",
      handler: "SettlementConfirmedListener",
      onError: ErrorHandlingStrategy.RETRY,
      timeout: 30000,
      async: true,
    },
  ],

  mermaidDiagram: `
graph TD
    A[Create Settlement] --> B[Confirm Settlement]
    B -->|financial.settlement.confirmed| C[SettlementConfirmedListener]
    C --> D[Update Mentor Payment Parameters]
    D --> E[Mark Payable Ledgers as Settled]

    subgraph "Settlement Service"
        A
        B
    end

    subgraph "Financial Domain Listener"
        C
        D
        E
    end
  `,

  monitoring: {
    alertOnStepFailure: true,
    maxFlowDuration: 60000,
    enableTracing: true,
    metrics: ["settlement_confirmation_count", "payment_params_updated"],
  },

  tags: ["financial", "settlement", "payment"],
  owner: "finance-team",
  lastUpdated: "2024-12-17",
};

/**
 * Mentor Appeal Flow
 * 导师申诉流程
 */
export const MentorAppealFlow: BusinessFlowDefinition = {
  id: "mentor-appeal",
  name: "Mentor Appeal Flow",
  description:
    "Complete flow for mentor appeals from creation to resolution",
  descriptionCN:
    "导师申诉从创建到解决的完整流程",
  version: "1.0",
  domain: "financial",
  entryPoint: "financial.appeal.created",
  terminationEvents: [
    "financial.appeal.approved",
    "financial.appeal.rejected",
  ],

  steps: [
    // Step 1: Appeal Created - Entry Point
    {
      id: "appeal-created",
      name: "Appeal Created",
      description: "Mentor submits an appeal for payment adjustment",
      triggerEvent: "financial.appeal.created",
      handler: "MentorAppealService.createAppeal",
      emitsEvents: ["financial.appeal.created"],
      next: [
        { to: "notify-admin", condition: "always" },
        { to: "await-review", condition: "always" },
      ],
      async: false,
    },

    // Step 2: Notify Admin
    {
      id: "notify-admin",
      name: "Notify Admin",
      description: "Send notification to admin about new appeal",
      triggerEvent: "financial.appeal.created",
      handler: "NotificationService",
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      async: true,
    },

    // Step 3: Await Review (human decision point)
    {
      id: "await-review",
      name: "Await Review",
      description: "Appeal awaits admin review and decision",
      triggerEvent: "internal",
      handler: "Admin Portal",
      next: [
        { to: "appeal-approved", condition: "admin approves" },
        { to: "appeal-rejected", condition: "admin rejects" },
      ],
    },

    // Step 4a: Appeal Approved
    {
      id: "appeal-approved",
      name: "Appeal Approved",
      description: "Admin approved the appeal",
      triggerEvent: "financial.appeal.approved",
      handler: "MentorAppealService.approveAppeal",
      emitsEvents: ["financial.appeal.approved"],
      next: "create-ledger-adjustment",
      async: false,
    },

    // Step 5a: Create Ledger Adjustment
    {
      id: "create-ledger-adjustment",
      name: "Create Ledger Adjustment",
      description:
        "Create payable ledger adjustment for approved appeal amount (with idempotency)",
      triggerEvent: "financial.appeal.approved",
      handler: "AppealApprovedListener",
      next: "notify-mentor-approved",
      onError: ErrorHandlingStrategy.FAIL_FAST,
      async: false,
    },

    // Step 6a: Notify Mentor Approved
    {
      id: "notify-mentor-approved",
      name: "Notify Mentor Approved",
      description: "Notify mentor that appeal was approved",
      triggerEvent: "financial.appeal.approved",
      handler: "NotificationService",
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      async: true,
    },

    // Step 4b: Appeal Rejected
    {
      id: "appeal-rejected",
      name: "Appeal Rejected",
      description: "Admin rejected the appeal",
      triggerEvent: "financial.appeal.rejected",
      handler: "MentorAppealService.rejectAppeal",
      emitsEvents: ["financial.appeal.rejected"],
      next: "notify-mentor-rejected",
      async: false,
    },

    // Step 5b: Notify Mentor Rejected
    {
      id: "notify-mentor-rejected",
      name: "Notify Mentor Rejected",
      description: "Notify mentor that appeal was rejected with reason",
      triggerEvent: "financial.appeal.rejected",
      handler: "NotificationService",
      onError: ErrorHandlingStrategy.LOG_AND_CONTINUE,
      async: true,
    },
  ],

  mermaidDiagram: `
graph TD
    A[Mentor Creates Appeal] -->|financial.appeal.created| B[Notify Admin]
    A --> C{Admin Review}
    C -->|Approve| D[Appeal Approved]
    C -->|Reject| E[Appeal Rejected]
    D -->|financial.appeal.approved| F[AppealApprovedListener]
    F --> G[Create Payable Ledger Adjustment]
    G --> H[Notify Mentor - Approved]
    E -->|financial.appeal.rejected| I[Notify Mentor - Rejected]

    subgraph "Appeal Service"
        A
        D
        E
    end

    subgraph "Admin Portal"
        C
    end

    subgraph "Financial Domain"
        F
        G
    end

    subgraph "Notification"
        B
        H
        I
    end
  `,

  monitoring: {
    alertOnStepFailure: true,
    maxFlowDuration: 86400000, // 24 hours (includes human review)
    enableTracing: true,
    metrics: [
      "appeal_created_count",
      "appeal_approved_rate",
      "appeal_resolution_time",
    ],
  },

  tags: ["financial", "appeal", "mentor", "payment"],
  owner: "finance-team",
  lastUpdated: "2024-12-17",
};
