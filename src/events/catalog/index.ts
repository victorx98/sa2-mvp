/**
 * Unified Event Catalog Index
 * 统一事件目录索引
 *
 * This is the single source of truth for all domain events in the system.
 * All events must be registered here with their complete metadata.
 *
 * 这是系统中所有领域事件的单一真相来源。
 * 所有事件必须在此处注册并包含完整的元数据。
 */

// Export types
export * from "./types";

// Import domain catalogs
import { SessionEventsCatalog } from "./session-events.catalog";
import { MeetingEventsCatalog } from "./meeting-events.catalog";
import { FinancialEventsCatalog } from "./financial-events.catalog";
import { PlacementEventsCatalog } from "./placement-events.catalog";
import { ContractEventsCatalog } from "./contract-events.catalog";

// Export individual domain catalogs for granular access
export { SessionEventsCatalog } from "./session-events.catalog";
export { MeetingEventsCatalog } from "./meeting-events.catalog";
export { FinancialEventsCatalog } from "./financial-events.catalog";
export { PlacementEventsCatalog } from "./placement-events.catalog";
export { ContractEventsCatalog } from "./contract-events.catalog";

// Re-export utility functions from domain catalogs
export {
  getAllSessionEventNames,
  getSessionEventsByTag,
  getSessionEventsByType,
} from "./session-events.catalog";

export {
  getAllMeetingEventNames,
  isMeetingEvent,
} from "./meeting-events.catalog";

export {
  getAllFinancialEventNames,
  getFinancialEventsByType,
  isFinancialEvent,
} from "./financial-events.catalog";

export {
  getAllPlacementEventNames,
  isPlacementEvent,
  getPlacementBillingEvents,
} from "./placement-events.catalog";

export {
  getAllContractEventNames,
  isContractEvent,
} from "./contract-events.catalog";

import {
  EventCatalogEntry,
  EventCatalogMap,
  EventDomain,
  EventType,
  CatalogValidationResult,
  EventFlowStep,
} from "./types";

/**
 * Unified Event Catalog
 * Combines all domain catalogs into a single registry
 * 统一事件目录 - 将所有领域目录合并为单一注册表
 */
export const EventCatalog: EventCatalogMap = {
  ...SessionEventsCatalog,
  ...MeetingEventsCatalog,
  ...FinancialEventsCatalog,
  ...PlacementEventsCatalog,
  ...ContractEventsCatalog,
};

// ============================================================
// Catalog Query Functions
// ============================================================

/**
 * Get all registered event names
 * 获取所有已注册的事件名称
 */
export function getAllEventNames(): string[] {
  return Object.keys(EventCatalog);
}

/**
 * Get event catalog entry by name
 * 按名称获取事件目录条目
 *
 * @param eventName - The event name constant
 * @returns The catalog entry or undefined if not found
 */
export function getEventEntry(eventName: string): EventCatalogEntry | undefined {
  return EventCatalog[eventName];
}

/**
 * Get all events for a specific domain
 * 获取特定领域的所有事件
 *
 * @param domain - The event domain to filter by
 * @returns Array of catalog entries for the domain
 */
export function getEventsByDomain(domain: EventDomain): EventCatalogEntry[] {
  return Object.values(EventCatalog).filter((entry) => entry.domain === domain);
}

/**
 * Get all events by event type
 * 按事件类型获取所有事件
 *
 * @param eventType - The event type to filter by
 * @returns Array of catalog entries matching the type
 */
export function getEventsByType(eventType: EventType): EventCatalogEntry[] {
  return Object.values(EventCatalog).filter(
    (entry) => entry.eventType === eventType,
  );
}

/**
 * Get all events with a specific tag
 * 获取具有特定标签的所有事件
 *
 * @param tag - The tag to search for
 * @returns Array of catalog entries with the tag
 */
export function getEventsByTag(tag: string): EventCatalogEntry[] {
  return Object.values(EventCatalog).filter((entry) =>
    entry.tags?.includes(tag),
  );
}

/**
 * Get all deprecated events
 * 获取所有已弃用的事件
 */
export function getDeprecatedEvents(): EventCatalogEntry[] {
  return Object.values(EventCatalog).filter((entry) => entry.deprecated);
}

/**
 * Get all events that a specific handler consumes
 * 获取特定处理器消费的所有事件
 *
 * @param handlerName - The handler class/function name
 * @returns Array of event names the handler consumes
 */
export function getEventsForHandler(handlerName: string): string[] {
  return Object.entries(EventCatalog)
    .filter(([_, entry]) =>
      entry.consumers.some((c) => c.handler === handlerName),
    )
    .map(([name]) => name);
}

/**
 * Get all events that a specific producer emits
 * 获取特定生产者发出的所有事件
 *
 * @param producerName - The producer class/function name
 * @returns Array of event names the producer emits
 */
export function getEventsForProducer(producerName: string): string[] {
  return Object.entries(EventCatalog)
    .filter(([_, entry]) => entry.producers.includes(producerName))
    .map(([name]) => name);
}

/**
 * Get downstream events triggered by an event
 * 获取事件触发的下游事件
 *
 * @param eventName - The source event name
 * @returns Array of event names that may be triggered
 */
export function getDownstreamEvents(eventName: string): string[] {
  const entry = EventCatalog[eventName];
  return entry?.triggers || [];
}

/**
 * Get upstream events required before an event
 * 获取事件之前需要的上游事件
 *
 * @param eventName - The target event name
 * @returns Array of event names that must occur first
 */
export function getUpstreamEvents(eventName: string): string[] {
  const entry = EventCatalog[eventName];
  return entry?.requires || [];
}

// ============================================================
// Event Flow Analysis Functions
// ============================================================

/**
 * Build event flow graph for visualization
 * 构建事件流图用于可视化
 *
 * @returns Array of flow steps representing the event graph
 */
export function buildEventFlowGraph(): EventFlowStep[] {
  const steps: EventFlowStep[] = [];

  Object.entries(EventCatalog).forEach(([eventName, entry]) => {
    // Add trigger relationships (event -> downstream events)
    entry.triggers?.forEach((triggeredEvent) => {
      steps.push({
        from: eventName,
        to: triggeredEvent,
        handler: entry.consumers[0]?.handler,
      });
    });

    // Also add requires relationships (upstream event -> this event)
    entry.requires?.forEach((requiredEvent) => {
      // Check if this relationship isn't already captured
      const exists = steps.some(
        (s) => s.from === requiredEvent && s.to === eventName,
      );
      if (!exists) {
        steps.push({
          from: requiredEvent,
          to: eventName,
          condition: "requires",
        });
      }
    });
  });

  return steps;
}

/**
 * Generate Mermaid diagram syntax for event flows
 * 生成事件流的Mermaid图表语法
 *
 * @param domain - Optional domain to filter by
 * @returns Mermaid diagram syntax string
 */
export function generateMermaidDiagram(domain?: EventDomain): string {
  const events = domain
    ? getEventsByDomain(domain)
    : Object.values(EventCatalog);

  const eventNames = new Set(events.map((e) => e.name));
  const lines: string[] = ["graph TD"];

  // Add subgraphs for domains
  const domainGroups = new Map<EventDomain, EventCatalogEntry[]>();
  events.forEach((event) => {
    const group = domainGroups.get(event.domain) || [];
    group.push(event);
    domainGroups.set(event.domain, group);
  });

  domainGroups.forEach((domainEvents, domainName) => {
    lines.push(`    subgraph ${domainName}`);
    domainEvents.forEach((event) => {
      // Use short name for node ID
      const nodeId = event.name.replace(/\./g, "_");
      const label = event.name.split(".").pop() || event.name;
      lines.push(`        ${nodeId}["${label}"]`);
    });
    lines.push("    end");
  });

  // Add edges for triggers
  events.forEach((event) => {
    const fromId = event.name.replace(/\./g, "_");
    event.triggers?.forEach((trigger) => {
      if (eventNames.has(trigger)) {
        const toId = trigger.replace(/\./g, "_");
        lines.push(`    ${fromId} --> ${toId}`);
      }
    });
  });

  return lines.join("\n");
}

// ============================================================
// Catalog Validation Functions
// ============================================================

/**
 * Validate the event catalog for consistency and completeness
 * 验证事件目录的一致性和完整性
 *
 * @returns Validation result with errors and warnings
 */
export function validateCatalog(): CatalogValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  Object.entries(EventCatalog).forEach(([eventName, entry]) => {
    // Check name consistency
    if (entry.name !== eventName) {
      errors.push(
        `Event "${eventName}" has mismatched name property: "${entry.name}"`,
      );
    }

    // Check for missing required fields
    if (!entry.description) {
      errors.push(`Event "${eventName}" is missing description`);
    }

    if (!entry.payloadType) {
      warnings.push(`Event "${eventName}" is missing payloadType`);
    }

    if (entry.producers.length === 0) {
      warnings.push(`Event "${eventName}" has no producers defined`);
    }

    // Validate trigger references
    entry.triggers?.forEach((trigger) => {
      if (!EventCatalog[trigger]) {
        warnings.push(
          `Event "${eventName}" triggers unknown event: "${trigger}"`,
        );
      }
    });

    // Validate requires references
    entry.requires?.forEach((required) => {
      if (!EventCatalog[required]) {
        warnings.push(
          `Event "${eventName}" requires unknown event: "${required}"`,
        );
      }
    });

    // Check for circular dependencies
    if (entry.triggers?.includes(eventName)) {
      errors.push(`Event "${eventName}" triggers itself (circular dependency)`);
    }

    // Check deprecated events have deprecation message
    if (entry.deprecated && !entry.deprecationMessage) {
      warnings.push(
        `Deprecated event "${eventName}" is missing deprecationMessage`,
      );
    }

    // Validate consumer configurations
    entry.consumers.forEach((consumer, index) => {
      if (!consumer.handler) {
        errors.push(
          `Event "${eventName}" consumer[${index}] is missing handler`,
        );
      }
      if (!consumer.module) {
        warnings.push(
          `Event "${eventName}" consumer "${consumer.handler}" is missing module`,
        );
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Print catalog statistics
 * 打印目录统计信息
 */
export function getCatalogStats(): {
  totalEvents: number;
  byDomain: Record<string, number>;
  byType: Record<string, number>;
  deprecatedCount: number;
  totalConsumers: number;
  totalProducers: number;
} {
  const entries = Object.values(EventCatalog);

  const byDomain: Record<string, number> = {};
  const byType: Record<string, number> = {};

  entries.forEach((entry) => {
    byDomain[entry.domain] = (byDomain[entry.domain] || 0) + 1;
    byType[entry.eventType] = (byType[entry.eventType] || 0) + 1;
  });

  return {
    totalEvents: entries.length,
    byDomain,
    byType,
    deprecatedCount: entries.filter((e) => e.deprecated).length,
    totalConsumers: entries.reduce((sum, e) => sum + e.consumers.length, 0),
    totalProducers: entries.reduce((sum, e) => sum + e.producers.length, 0),
  };
}
