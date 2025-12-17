/**
 * Events Infrastructure Module Exports
 * 事件基础设施模块导出
 *
 * Exports all infrastructure components for the enhanced event system.
 * 导出增强事件系统的所有基础设施组件。
 */

// Correlation ID Provider
export {
  CorrelationIdProvider,
  CorrelationIdMiddleware,
  CorrelationContext,
  correlationStorage,
  getCurrentCorrelationId,
  hasCorrelationContext,
} from "./correlation-id.provider";

// Event Flow Context & Tracker
export {
  EventFlowTracker,
  EventFlowStatus,
  EventFlowRecord,
  EventFlowContextData,
  EventHandlerResult,
} from "./event-flow-context";

// Enhanced Event Bus
export {
  EnhancedEventBus,
  EnhancedEventMetadata,
  EnhancedEvent,
  EmitOptions,
  EmitResult,
  EventValidationResult,
  TrackedEventHandler,
} from "./enhanced-event-bus";
