/**
 * Flow Definition Types
 * 流程定义类型
 *
 * Defines the structure for declarative business flow configuration.
 * These definitions serve as documentation and enable flow visualization.
 *
 * 定义声明式业务流程配置的结构。
 * 这些定义作为文档并支持流程可视化。
 */

import { ErrorHandlingStrategy } from "@events/catalog/types";

/**
 * Step in a business flow
 * 业务流程中的步骤
 */
export interface FlowStep {
  /**
   * Unique identifier for this step
   * 此步骤的唯一标识符
   */
  id: string;

  /**
   * Human-readable name for the step
   * 步骤的可读名称
   */
  name: string;

  /**
   * Description of what this step does
   * 此步骤做什么的描述
   */
  description: string;

  /**
   * Event that triggers this step
   * 触发此步骤的事件
   */
  triggerEvent: string;

  /**
   * Handler that processes this step
   * 处理此步骤的处理器
   */
  handler: string;

  /**
   * Events that this step may emit
   * 此步骤可能发出的事件
   */
  emitsEvents?: string[];

  /**
   * Next step(s) in the flow
   * 流程中的下一步
   */
  next?: string | FlowTransition[];

  /**
   * Timeout for this step in milliseconds
   * 此步骤的超时时间（毫秒）
   */
  timeout?: number;

  /**
   * Number of retries on failure
   * 失败时的重试次数
   */
  retries?: number;

  /**
   * Error handling strategy
   * 错误处理策略
   */
  onError?: ErrorHandlingStrategy;

  /**
   * Whether this step is async
   * 此步骤是否异步
   */
  async?: boolean;

  /**
   * Compensation step for rollback (saga pattern)
   * 用于回滚的补偿步骤（saga模式）
   */
  compensationStep?: string;
}

/**
 * Conditional transition between flow steps
 * 流程步骤之间的条件转换
 */
export interface FlowTransition {
  /**
   * Target step ID
   * 目标步骤ID
   */
  to: string;

  /**
   * Condition for this transition (human-readable)
   * 此转换的条件（可读）
   */
  condition?: string;

  /**
   * Event that triggers this transition
   * 触发此转换的事件
   */
  onEvent?: string;

  /**
   * Label for the transition (used in diagrams)
   * 转换的标签（用于图表）
   */
  label?: string;
}

/**
 * Monitoring configuration for a flow
 * 流程的监控配置
 */
export interface FlowMonitoring {
  /**
   * Alert on step failure
   * 步骤失败时警报
   */
  alertOnStepFailure?: boolean;

  /**
   * Maximum flow duration before timeout (ms)
   * 超时前的最大流程持续时间（毫秒）
   */
  maxFlowDuration?: number;

  /**
   * Dead letter queue for failed events
   * 失败事件的死信队列
   */
  deadLetterQueue?: string;

  /**
   * Enable detailed tracing
   * 启用详细追踪
   */
  enableTracing?: boolean;

  /**
   * Custom metrics to collect
   * 要收集的自定义指标
   */
  metrics?: string[];
}

/**
 * Complete business flow definition
 * 完整的业务流程定义
 */
export interface BusinessFlowDefinition {
  /**
   * Unique identifier for the flow
   * 流程的唯一标识符
   */
  id: string;

  /**
   * Human-readable name
   * 可读名称
   */
  name: string;

  /**
   * Detailed description
   * 详细描述
   */
  description: string;

  /**
   * Description in Chinese (optional)
   * 中文描述（可选）
   */
  descriptionCN?: string;

  /**
   * Version of the flow definition
   * 流程定义的版本
   */
  version: string;

  /**
   * Domain this flow belongs to
   * 此流程所属的域
   */
  domain: string;

  /**
   * Entry point event that starts this flow
   * 启动此流程的入口点事件
   */
  entryPoint: string;

  /**
   * Terminal events that end this flow
   * 结束此流程的终端事件
   */
  terminationEvents: string[];

  /**
   * Steps in this flow
   * 此流程中的步骤
   */
  steps: FlowStep[];

  /**
   * Mermaid-compatible flow diagram
   * 与Mermaid兼容的流程图
   */
  mermaidDiagram?: string;

  /**
   * Monitoring configuration
   * 监控配置
   */
  monitoring?: FlowMonitoring;

  /**
   * Tags for categorization
   * 分类标签
   */
  tags?: string[];

  /**
   * Whether this flow is deprecated
   * 此流程是否已弃用
   */
  deprecated?: boolean;

  /**
   * Author/owner of this flow
   * 此流程的作者/所有者
   */
  owner?: string;

  /**
   * Last updated timestamp
   * 最后更新时间戳
   */
  lastUpdated?: string;
}

/**
 * Collection of all business flows
 * 所有业务流程的集合
 */
export type BusinessFlowsRegistry = Record<string, BusinessFlowDefinition>;

/**
 * Flow validation result
 * 流程验证结果
 */
export interface FlowValidationResult {
  valid: boolean;
  flowId: string;
  errors: string[];
  warnings: string[];
}
