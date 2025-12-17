/**
 * Event Catalog Type Definitions
 * 事件目录类型定义
 *
 * Defines the structure for centralized event registration.
 * All events must be registered in the catalog with metadata.
 * 定义集中事件注册的结构。所有事件必须在目录中注册并包含元数据。
 */

/**
 * Priority levels for event consumers
 * Higher priority consumers execute first
 * 事件消费者的优先级，高优先级消费者先执行
 */
export enum ConsumerPriority {
  CRITICAL = 1, // Must execute first, failure blocks flow (必须首先执行，失败会阻塞流程)
  HIGH = 2, // Important business logic (重要业务逻辑)
  NORMAL = 3, // Standard processing (标准处理)
  LOW = 4, // Can be delayed or skipped (可以延迟或跳过)
  BACKGROUND = 5, // Analytics, logging, etc. (分析、日志等)
}

/**
 * Error handling strategy for event consumers
 * 事件消费者的错误处理策略
 */
export enum ErrorHandlingStrategy {
  FAIL_FAST = "fail-fast", // Stop processing immediately (立即停止处理)
  LOG_AND_CONTINUE = "log-and-continue", // Log error and continue to next consumer (记录错误并继续)
  RETRY = "retry", // Retry with backoff (带退避重试)
  DEAD_LETTER = "dead-letter", // Send to dead-letter queue (发送到死信队列)
}

/**
 * Event consumer definition
 * Describes a handler that listens to this event
 * 事件消费者定义，描述监听此事件的处理器
 */
export interface EventConsumer {
  /**
   * Handler name or class name
   * 处理器名称或类名
   */
  handler: string;

  /**
   * Execution priority (lower = higher priority)
   * 执行优先级（数值越低优先级越高）
   */
  priority: ConsumerPriority;

  /**
   * Whether this consumer runs asynchronously
   * 此消费者是否异步运行
   */
  async: boolean;

  /**
   * Module where the handler is located
   * 处理器所在的模块
   */
  module: string;

  /**
   * Optional description of what this consumer does
   * 此消费者功能的可选描述
   */
  description?: string;

  /**
   * Error handling strategy for this consumer
   * 此消费者的错误处理策略
   */
  errorStrategy?: ErrorHandlingStrategy;

  /**
   * Timeout in milliseconds (default: 30000)
   * 超时时间（毫秒），默认30000
   */
  timeout?: number;
}

/**
 * Event domain categories
 * 事件领域分类
 */
export enum EventDomain {
  SESSION = "session", // Session management events (会话管理事件)
  MEETING = "meeting", // Meeting lifecycle events (会议生命周期事件)
  FINANCIAL = "financial", // Financial/billing events (财务/计费事件)
  CONTRACT = "contract", // Contract/service events (合同/服务事件)
  PLACEMENT = "placement", // Job placement events (就业安置事件)
  USER = "user", // User management events (用户管理事件)
  NOTIFICATION = "notification", // Notification events (通知事件)
}

/**
 * Event type categories for flow analysis
 * 用于流程分析的事件类型分类
 */
export enum EventType {
  TRIGGER = "trigger", // Initiates a workflow (触发工作流)
  RESULT = "result", // Result of an operation (操作结果)
  STATE_CHANGE = "state-change", // State transition (状态转换)
  INTEGRATION = "integration", // Cross-domain integration (跨域集成)
}

/**
 * Event catalog entry definition
 * Full metadata for a registered event
 * 事件目录条目定义，注册事件的完整元数据
 */
export interface EventCatalogEntry<TPayload = unknown> {
  /**
   * Event name constant (must match the exported constant)
   * 事件名称常量（必须与导出的常量匹配）
   */
  name: string;

  /**
   * Human-readable description of the event
   * 事件的可读描述
   */
  description: string;

  /**
   * Detailed description in Chinese (optional)
   * 详细中文描述（可选）
   */
  descriptionCN?: string;

  /**
   * Domain this event belongs to
   * 此事件所属的领域
   */
  domain: EventDomain;

  /**
   * Event type for flow analysis
   * 用于流程分析的事件类型
   */
  eventType: EventType;

  /**
   * TypeScript type reference for the payload
   * Payload 的 TypeScript 类型引用
   */
  payloadType: string;

  /**
   * Services/classes that produce this event
   * 产生此事件的服务/类
   */
  producers: string[];

  /**
   * Handlers that consume this event
   * 消费此事件的处理器
   */
  consumers: EventConsumer[];

  /**
   * Events that this event may trigger downstream
   * 此事件可能触发的下游事件
   */
  triggers?: string[];

  /**
   * Events that must occur before this event
   * 此事件之前必须发生的事件
   */
  requires?: string[];

  /**
   * Version of this event schema
   * 此事件模式的版本
   */
  version?: string;

  /**
   * Whether this event is deprecated
   * 此事件是否已弃用
   */
  deprecated?: boolean;

  /**
   * Deprecation message if deprecated
   * 弃用消息
   */
  deprecationMessage?: string;

  /**
   * Tags for categorization and filtering
   * 用于分类和过滤的标签
   */
  tags?: string[];
}

/**
 * Type-safe event catalog map
 * Maps event name constants to their catalog entries
 * 类型安全的事件目录映射，将事件名称常量映射到其目录条目
 */
export type EventCatalogMap = Record<string, EventCatalogEntry>;

/**
 * Event flow step definition for flow diagrams
 * 用于流程图的事件流程步骤定义
 */
export interface EventFlowStep {
  /**
   * Source event name
   * 源事件名称
   */
  from: string;

  /**
   * Target event name
   * 目标事件名称
   */
  to: string;

  /**
   * Condition for this transition (optional)
   * 此转换的条件（可选）
   */
  condition?: string;

  /**
   * Handler that performs this transition
   * 执行此转换的处理器
   */
  handler?: string;
}

/**
 * Catalog validation result
 * 目录验证结果
 */
export interface CatalogValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
