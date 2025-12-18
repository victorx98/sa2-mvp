/**
 * Saga Orchestrator Types
 * Saga 编排器类型定义
 *
 * Defines the core types for saga pattern implementation:
 * - SagaStep: Individual step with execute and compensate functions
 * - SagaDefinition: Complete saga with ordered steps
 * - SagaContext: Runtime context with correlation and step results
 * - SagaResult: Execution result with success/failure details
 *
 * 定义 Saga 模式实现的核心类型：
 * - SagaStep: 包含执行和补偿函数的单个步骤
 * - SagaDefinition: 包含有序步骤的完整 Saga
 * - SagaContext: 运行时上下文，包含关联和步骤结果
 * - SagaResult: 执行结果，包含成功/失败详情
 */

/**
 * Error handling strategy for saga steps
 * Saga 步骤的错误处理策略
 */
export enum SagaStepErrorStrategy {
  /**
   * Fail the saga and trigger compensation
   * 失败并触发补偿
   */
  FAIL = "fail",

  /**
   * Skip this step and continue
   * 跳过此步骤并继续
   */
  SKIP = "skip",

  /**
   * Retry the step (uses step's retry config)
   * 重试此步骤（使用步骤的重试配置）
   */
  RETRY = "retry",
}

/**
 * Saga execution status
 * Saga 执行状态
 */
export enum SagaStatus {
  /**
   * Saga is currently running
   * Saga 正在运行
   */
  RUNNING = "running",

  /**
   * Saga completed successfully
   * Saga 成功完成
   */
  COMPLETED = "completed",

  /**
   * Saga failed and is compensating
   * Saga 失败，正在补偿
   */
  COMPENSATING = "compensating",

  /**
   * Saga failed and compensation completed
   * Saga 失败，补偿完成
   */
  FAILED = "failed",

  /**
   * Saga failed and compensation also failed
   * Saga 失败，补偿也失败
   */
  COMPENSATION_FAILED = "compensation_failed",
}

/**
 * Individual saga step definition
 * 单个 Saga 步骤定义
 *
 * @template TInput - Input type for this step
 * @template TOutput - Output type from this step
 */
export interface SagaStep<TInput = unknown, TOutput = unknown> {
  /**
   * Unique step identifier
   * 唯一步骤标识符
   */
  id: string;

  /**
   * Human-readable step name
   * 可读的步骤名称
   */
  name: string;

  /**
   * Step description (optional)
   * 步骤描述（可选）
   */
  description?: string;

  /**
   * Execute function - performs the step's action
   * 执行函数 - 执行步骤的操作
   *
   * @param input - Input from previous step or saga input
   * @param context - Saga execution context
   * @returns Output to pass to next step
   */
  execute: (input: TInput, context: SagaContext) => Promise<TOutput>;

  /**
   * Compensate function - undoes the step's action
   * 补偿函数 - 撤销步骤的操作
   *
   * Called in reverse order when saga fails.
   * Saga 失败时按逆序调用。
   *
   * @param input - The input that was passed to execute
   * @param output - The output that execute returned (if successful)
   * @param context - Saga execution context
   */
  compensate?: (
    input: TInput,
    output: TOutput | undefined,
    context: SagaContext,
  ) => Promise<void>;

  /**
   * Step timeout in milliseconds
   * 步骤超时时间（毫秒）
   * @default 30000
   */
  timeout?: number;

  /**
   * Number of retry attempts before failing
   * 失败前的重试次数
   * @default 0
   */
  retries?: number;

  /**
   * Initial retry delay in milliseconds (exponential backoff applied)
   * 初始重试延迟（毫秒，应用指数退避）
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Error handling strategy
   * 错误处理策略
   * @default SagaStepErrorStrategy.FAIL
   */
  onError?: SagaStepErrorStrategy;

  /**
   * Whether this step is critical (compensation required on failure)
   * 此步骤是否关键（失败时需要补偿）
   * @default true
   */
  critical?: boolean;
}

/**
 * Saga definition - describes the complete saga flow
 * Saga 定义 - 描述完整的 Saga 流程
 *
 * @template TInput - Input type for the saga
 * @template TOutput - Output type from the saga
 */
export interface SagaDefinition<TInput = unknown, TOutput = unknown> {
  /**
   * Unique saga identifier
   * 唯一 Saga 标识符
   */
  id: string;

  /**
   * Human-readable saga name
   * 可读的 Saga 名称
   */
  name: string;

  /**
   * Saga description
   * Saga 描述
   */
  description?: string;

  /**
   * Saga version (for compatibility tracking)
   * Saga 版本（用于兼容性追踪）
   */
  version?: string;

  /**
   * Ordered list of saga steps
   * 有序的 Saga 步骤列表
   */
  steps: SagaStep<unknown, unknown>[];

  /**
   * Callback when saga completes successfully
   * Saga 成功完成时的回调
   */
  onComplete?: (result: TOutput, context: SagaContext) => void | Promise<void>;

  /**
   * Callback when saga fails (after compensation)
   * Saga 失败时的回调（补偿后）
   */
  onFailed?: (error: Error, context: SagaContext) => void | Promise<void>;

  /**
   * Callback when compensation fails
   * 补偿失败时的回调
   */
  onCompensationFailed?: (
    originalError: Error,
    compensationErrors: CompensationError[],
    context: SagaContext,
  ) => void | Promise<void>;

  /**
   * Overall saga timeout in milliseconds
   * 整体 Saga 超时时间（毫秒）
   * @default 120000 (2 minutes)
   */
  timeout?: number;

  /**
   * Tags for categorization and filtering
   * 用于分类和过滤的标签
   */
  tags?: string[];
}

/**
 * Saga execution context
 * Saga 执行上下文
 *
 * Passed to each step, contains correlation info and accumulated results.
 * 传递给每个步骤，包含关联信息和累积结果。
 */
export interface SagaContext {
  /**
   * Unique correlation ID for this saga execution
   * 此 Saga 执行的唯一关联 ID
   */
  correlationId: string;

  /**
   * Root correlation ID (from original request)
   * 根关联 ID（来自原始请求）
   */
  rootCorrelationId: string;

  /**
   * Saga start timestamp
   * Saga 开始时间戳
   */
  startTime: number;

  /**
   * Current saga status
   * 当前 Saga 状态
   */
  status: SagaStatus;

  /**
   * Results from each completed step
   * 每个完成步骤的结果
   */
  stepResults: Map<string, unknown>;

  /**
   * List of step IDs that have been executed
   * 已执行的步骤 ID 列表
   */
  executedSteps: string[];

  /**
   * List of step IDs that have been compensated
   * 已补偿的步骤 ID 列表
   */
  compensatedSteps: string[];

  /**
   * Additional metadata for debugging/logging
   * 用于调试/日志的附加元数据
   */
  metadata: Record<string, unknown>;

  /**
   * Get result from a specific step
   * 获取特定步骤的结果
   */
  getStepResult<T>(stepId: string): T | undefined;

  /**
   * Set custom metadata
   * 设置自定义元数据
   */
  setMetadata(key: string, value: unknown): void;
}

/**
 * Compensation error details
 * 补偿错误详情
 */
export interface CompensationError {
  /**
   * Step ID where compensation failed
   * 补偿失败的步骤 ID
   */
  stepId: string;

  /**
   * Step name for logging
   * 用于日志的步骤名称
   */
  stepName: string;

  /**
   * Error that occurred during compensation
   * 补偿期间发生的错误
   */
  error: Error;

  /**
   * Timestamp of compensation failure
   * 补偿失败的时间戳
   */
  timestamp: number;
}

/**
 * Saga execution result
 * Saga 执行结果
 *
 * @template T - Output type from the saga
 */
export interface SagaResult<T = unknown> {
  /**
   * Whether the saga completed successfully
   * Saga 是否成功完成
   */
  success: boolean;

  /**
   * Final result from the saga (if successful)
   * Saga 的最终结果（如果成功）
   */
  result?: T;

  /**
   * Error that caused failure (if failed)
   * 导致失败的错误（如果失败）
   */
  error?: Error;

  /**
   * Final saga status
   * 最终 Saga 状态
   */
  status: SagaStatus;

  /**
   * Correlation ID for tracing
   * 用于追踪的关联 ID
   */
  correlationId: string;

  /**
   * List of steps that were executed
   * 已执行的步骤列表
   */
  executedSteps: string[];

  /**
   * List of steps that were compensated
   * 已补偿的步骤列表
   */
  compensatedSteps: string[];

  /**
   * Compensation errors (if any)
   * 补偿错误（如果有）
   */
  compensationErrors?: CompensationError[];

  /**
   * Total execution duration in milliseconds
   * 总执行时间（毫秒）
   */
  duration: number;

  /**
   * Individual step durations
   * 各步骤执行时间
   */
  stepDurations: Record<string, number>;
}

/**
 * Saga event types for monitoring
 * 用于监控的 Saga 事件类型
 */
export interface SagaEvents {
  /**
   * Emitted when saga starts
   * Saga 开始时发出
   */
  "saga.started": {
    sagaId: string;
    correlationId: string;
    input: unknown;
    timestamp: number;
  };

  /**
   * Emitted when a step starts
   * 步骤开始时发出
   */
  "saga.step.started": {
    sagaId: string;
    stepId: string;
    stepName: string;
    correlationId: string;
    timestamp: number;
  };

  /**
   * Emitted when a step completes
   * 步骤完成时发出
   */
  "saga.step.completed": {
    sagaId: string;
    stepId: string;
    stepName: string;
    correlationId: string;
    duration: number;
    timestamp: number;
  };

  /**
   * Emitted when a step fails
   * 步骤失败时发出
   */
  "saga.step.failed": {
    sagaId: string;
    stepId: string;
    stepName: string;
    correlationId: string;
    error: string;
    attempt: number;
    willRetry: boolean;
    timestamp: number;
  };

  /**
   * Emitted when compensation starts
   * 补偿开始时发出
   */
  "saga.compensation.started": {
    sagaId: string;
    correlationId: string;
    stepsToCompensate: string[];
    timestamp: number;
  };

  /**
   * Emitted when a step is compensated
   * 步骤被补偿时发出
   */
  "saga.step.compensated": {
    sagaId: string;
    stepId: string;
    stepName: string;
    correlationId: string;
    timestamp: number;
  };

  /**
   * Emitted when saga completes successfully
   * Saga 成功完成时发出
   */
  "saga.completed": {
    sagaId: string;
    correlationId: string;
    duration: number;
    stepCount: number;
    timestamp: number;
  };

  /**
   * Emitted when saga fails
   * Saga 失败时发出
   */
  "saga.failed": {
    sagaId: string;
    correlationId: string;
    error: string;
    executedSteps: string[];
    compensatedSteps: string[];
    duration: number;
    timestamp: number;
  };
}

/**
 * Options for saga execution
 * Saga 执行选项
 */
export interface SagaExecutionOptions {
  /**
   * Override correlation ID
   * 覆盖关联 ID
   */
  correlationId?: string;

  /**
   * Initial metadata
   * 初始元数据
   */
  metadata?: Record<string, unknown>;

  /**
   * Override saga timeout
   * 覆盖 Saga 超时
   */
  timeout?: number;

  /**
   * Skip specific steps (for recovery scenarios)
   * 跳过特定步骤（用于恢复场景）
   */
  skipSteps?: string[];

  /**
   * Pre-populate step results (for recovery scenarios)
   * 预填充步骤结果（用于恢复场景）
   */
  preloadResults?: Map<string, unknown>;
}
