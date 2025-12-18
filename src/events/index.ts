/**
 * Events Module Main Export
 * 事件模块主导出
 *
 * This is the main entry point for the enhanced event-driven architecture.
 * Import from '@events' to access all event-related functionality.
 *
 * 这是增强事件驱动架构的主入口点。
 * 从'@events'导入以访问所有事件相关功能。
 *
 * @example
 * ```typescript
 * import {
 *   EventsModule,
 *   EnhancedEventBus,
 *   EventCatalog,
 *   getEventEntry,
 *   BusinessFlows,
 * } from '@events';
 * ```
 */

// Module
export { EventsModule, EventsModuleOptions, EventsFeatureModule } from "./events.module";

// Catalog
export * from "./catalog";

// Infrastructure
export * from "./infrastructure";

// Flows
export * from "./flows";

// Sagas
export * from "./sagas";

// Re-export commonly used items at top level for convenience
export {
  EnhancedEventBus,
  EnhancedEvent,
  EnhancedEventMetadata,
  EmitOptions,
  EmitResult,
  TrackedEventHandler,
} from "./infrastructure/enhanced-event-bus";

export {
  CorrelationIdProvider,
  CorrelationContext,
  getCurrentCorrelationId,
  hasCorrelationContext,
} from "./infrastructure/correlation-id.provider";

export {
  EventFlowTracker,
  EventFlowStatus,
  EventFlowRecord,
} from "./infrastructure/event-flow-context";

export {
  EventCatalog,
  EventCatalogEntry,
  EventDomain,
  EventType,
  ConsumerPriority,
  ErrorHandlingStrategy,
  getEventEntry,
  getEventsByDomain,
  getEventsByType,
  getEventsByTag,
  validateCatalog,
  getCatalogStats,
  generateMermaidDiagram,
} from "./catalog";

// Flow definitions
export {
  BusinessFlows,
  getFlowDefinition,
  getAllFlowIds,
  getFlowsByDomain,
  validateFlow,
  validateAllFlows,
  getFlowDiagram,
  getFlowStats,
  BusinessFlowDefinition,
  FlowStep,
  FlowTransition,
} from "./flows";

// Saga exports
export {
  SagaOrchestrator,
  SagaDefinition,
  SagaStep,
  SagaContext,
  SagaResult,
  SagaStatus,
  SagaStepErrorStrategy,
  SagaExecutionOptions,
  CompensationError,
  SessionBookingSaga,
  SessionBookingSagaInput,
  SessionBookingSagaOutput,
} from "./sagas";
