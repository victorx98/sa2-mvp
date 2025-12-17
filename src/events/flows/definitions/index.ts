/**
 * Business Flow Definitions Index
 * 业务流程定义索引
 *
 * Central registry of all business flow definitions.
 * These definitions document the event flows in the system.
 *
 * 所有业务流程定义的中央注册表。
 * 这些定义记录了系统中的事件流。
 */

// Export types
export * from "./types";

// Import flow definitions
import {
  SessionBookingFlow,
  SessionTypeMapping,
} from "./session-booking.flow";
import {
  SessionCompletionFlow,
  SessionRecordingFlow,
} from "./session-completion.flow";
import {
  PlacementApplicationFlow,
  PlacementRollbackFlow,
} from "./placement-application.flow";
import { SettlementFlow, MentorAppealFlow } from "./settlement.flow";

// Export individual flows
export {
  SessionBookingFlow,
  SessionTypeMapping,
} from "./session-booking.flow";
export {
  SessionCompletionFlow,
  SessionRecordingFlow,
} from "./session-completion.flow";
export {
  PlacementApplicationFlow,
  PlacementRollbackFlow,
} from "./placement-application.flow";
export { SettlementFlow, MentorAppealFlow } from "./settlement.flow";

import {
  BusinessFlowDefinition,
  BusinessFlowsRegistry,
  FlowValidationResult,
} from "./types";
import { EventCatalog } from "@events/catalog";

/**
 * Unified Business Flows Registry
 * All flow definitions aggregated in one place
 * 统一的业务流程注册表，所有流程定义聚合在一处
 */
export const BusinessFlows: BusinessFlowsRegistry = {
  // Session flows
  "session-booking": SessionBookingFlow,
  "session-completion": SessionCompletionFlow,
  "session-recording": SessionRecordingFlow,

  // Placement flows
  "placement-application": PlacementApplicationFlow,
  "placement-rollback": PlacementRollbackFlow,

  // Financial flows
  "settlement-confirmation": SettlementFlow,
  "mentor-appeal": MentorAppealFlow,
};

// ============================================================
// Flow Query Functions
// ============================================================

/**
 * Get all flow IDs
 * 获取所有流程ID
 */
export function getAllFlowIds(): string[] {
  return Object.keys(BusinessFlows);
}

/**
 * Get a flow definition by ID
 * 按ID获取流程定义
 *
 * @param flowId - Flow identifier
 * @returns The flow definition or undefined
 */
export function getFlowDefinition(
  flowId: string,
): BusinessFlowDefinition | undefined {
  return BusinessFlows[flowId];
}

/**
 * Get flows by domain
 * 按域获取流程
 *
 * @param domain - Domain to filter by
 * @returns Array of flow definitions
 */
export function getFlowsByDomain(domain: string): BusinessFlowDefinition[] {
  return Object.values(BusinessFlows).filter((flow) => flow.domain === domain);
}

/**
 * Get flows by tag
 * 按标签获取流程
 *
 * @param tag - Tag to search for
 * @returns Array of flow definitions
 */
export function getFlowsByTag(tag: string): BusinessFlowDefinition[] {
  return Object.values(BusinessFlows).filter((flow) =>
    flow.tags?.includes(tag),
  );
}

/**
 * Get flows that start with a specific event
 * 获取以特定事件开始的流程
 *
 * @param eventName - Entry point event name
 * @returns Array of flow definitions
 */
export function getFlowsForEvent(eventName: string): BusinessFlowDefinition[] {
  return Object.values(BusinessFlows).filter(
    (flow) =>
      flow.entryPoint === eventName ||
      flow.entryPoint.includes("{") || // Template event
      flow.steps.some((step) => step.triggerEvent === eventName),
  );
}

// ============================================================
// Flow Validation Functions
// ============================================================

/**
 * Validate a flow definition
 * 验证流程定义
 *
 * @param flow - Flow definition to validate
 * @returns Validation result
 */
export function validateFlow(flow: BusinessFlowDefinition): FlowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required fields
  if (!flow.id) errors.push("Flow is missing id");
  if (!flow.name) errors.push("Flow is missing name");
  if (!flow.entryPoint) errors.push("Flow is missing entryPoint");
  if (!flow.steps || flow.steps.length === 0) {
    errors.push("Flow has no steps defined");
  }

  // Validate steps
  const stepIds = new Set<string>();
  flow.steps.forEach((step, index) => {
    if (!step.id) {
      errors.push(`Step ${index} is missing id`);
    } else if (stepIds.has(step.id)) {
      errors.push(`Duplicate step id: ${step.id}`);
    } else {
      stepIds.add(step.id);
    }

    if (!step.handler) {
      warnings.push(`Step "${step.id}" is missing handler`);
    }

    // Check if trigger event exists in catalog (skip template events)
    if (
      step.triggerEvent &&
      step.triggerEvent !== "internal" &&
      !step.triggerEvent.includes("{")
    ) {
      if (!EventCatalog[step.triggerEvent]) {
        warnings.push(
          `Step "${step.id}" triggers unknown event: ${step.triggerEvent}`,
        );
      }
    }

    // Check next step references
    if (typeof step.next === "string" && step.next && !stepIds.has(step.next)) {
      // Allow forward references - will be checked at the end
    } else if (Array.isArray(step.next)) {
      step.next.forEach((transition) => {
        if (!stepIds.has(transition.to) && !flow.steps.some(s => s.id === transition.to)) {
          warnings.push(
            `Step "${step.id}" has transition to unknown step: ${transition.to}`,
          );
        }
      });
    }
  });

  // Check entry point has a corresponding step
  const hasEntryStep = flow.steps.some(
    (step) =>
      step.triggerEvent === flow.entryPoint ||
      flow.entryPoint.includes("{"), // Template
  );
  if (!hasEntryStep) {
    warnings.push(`No step handles entry point event: ${flow.entryPoint}`);
  }

  return {
    valid: errors.length === 0,
    flowId: flow.id,
    errors,
    warnings,
  };
}

/**
 * Validate all registered flows
 * 验证所有已注册的流程
 *
 * @returns Array of validation results
 */
export function validateAllFlows(): FlowValidationResult[] {
  return Object.values(BusinessFlows).map(validateFlow);
}

// ============================================================
// Diagram Generation Functions
// ============================================================

/**
 * Get Mermaid diagram for a flow
 * 获取流程的Mermaid图
 *
 * @param flowId - Flow identifier
 * @returns Mermaid diagram syntax or undefined
 */
export function getFlowDiagram(flowId: string): string | undefined {
  const flow = BusinessFlows[flowId];
  return flow?.mermaidDiagram;
}

/**
 * Generate a combined Mermaid diagram for all flows in a domain
 * 为域中的所有流程生成组合Mermaid图
 *
 * @param domain - Domain to generate diagram for
 * @returns Combined Mermaid diagram
 */
export function generateDomainDiagram(domain: string): string {
  const domainFlows = getFlowsByDomain(domain);
  const lines: string[] = ["graph TD"];

  domainFlows.forEach((flow) => {
    lines.push(`    subgraph ${flow.id}[${flow.name}]`);

    flow.steps.forEach((step) => {
      const nodeId = `${flow.id}_${step.id}`.replace(/-/g, "_");
      lines.push(`        ${nodeId}["${step.name}"]`);
    });

    lines.push("    end");
  });

  return lines.join("\n");
}

/**
 * Get flow statistics
 * 获取流程统计信息
 */
export function getFlowStats(): {
  totalFlows: number;
  byDomain: Record<string, number>;
  totalSteps: number;
  criticalPathFlows: number;
} {
  const flows = Object.values(BusinessFlows);

  const byDomain: Record<string, number> = {};
  let totalSteps = 0;
  let criticalPathFlows = 0;

  flows.forEach((flow) => {
    byDomain[flow.domain] = (byDomain[flow.domain] || 0) + 1;
    totalSteps += flow.steps.length;
    if (flow.tags?.includes("critical-path")) {
      criticalPathFlows++;
    }
  });

  return {
    totalFlows: flows.length,
    byDomain,
    totalSteps,
    criticalPathFlows,
  };
}
