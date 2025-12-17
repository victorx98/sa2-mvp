/**
 * Flows Module Exports
 * 流程模块导出
 *
 * Exports all flow-related functionality including:
 * - Flow definitions (declarative business flow configuration)
 * - Flow validation and query functions
 *
 * 导出所有流程相关功能，包括：
 * - 流程定义（声明式业务流程配置）
 * - 流程验证和查询函数
 */

// Export all from definitions
export * from "./definitions";

// Re-export commonly used items at top level
export {
  BusinessFlows,
  getFlowDefinition,
  getAllFlowIds,
  getFlowsByDomain,
  getFlowsByTag,
  getFlowsForEvent,
  validateFlow,
  validateAllFlows,
  getFlowDiagram,
  getFlowStats,
} from "./definitions";

export type {
  BusinessFlowDefinition,
  BusinessFlowsRegistry,
  FlowStep,
  FlowTransition,
  FlowMonitoring,
  FlowValidationResult,
} from "./definitions/types";
