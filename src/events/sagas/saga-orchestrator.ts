/**
 * Saga Orchestrator
 * Saga 编排器
 *
 * Core orchestrator for executing saga patterns with:
 * - Sequential step execution
 * - Automatic compensation on failure
 * - Retry with exponential backoff
 * - Timeout handling
 * - Event emission for monitoring
 *
 * 用于执行 Saga 模式的核心编排器：
 * - 顺序步骤执行
 * - 失败时自动补偿
 * - 指数退避重试
 * - 超时处理
 * - 事件发射用于监控
 *
 * @example
 * ```typescript
 * const result = await orchestrator.execute(sessionBookingSaga, {
 *   sessionId: '123',
 *   meetingProvider: 'feishu',
 * });
 *
 * if (!result.success) {
 *   console.log('Saga failed:', result.error);
 *   console.log('Compensated steps:', result.compensatedSteps);
 * }
 * ```
 */

import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { v4 as uuidv4 } from "uuid";

import { CorrelationIdProvider } from "../infrastructure/correlation-id.provider";
import { EventFlowTracker } from "../infrastructure/event-flow-context";
import {
  SagaDefinition,
  SagaStep,
  SagaContext,
  SagaResult,
  SagaStatus,
  SagaStepErrorStrategy,
  SagaExecutionOptions,
  CompensationError,
} from "./types";

/**
 * Default timeout for saga execution (2 minutes)
 * 默认 Saga 执行超时时间（2 分钟）
 */
const DEFAULT_SAGA_TIMEOUT = 120000;

/**
 * Default timeout for individual steps (30 seconds)
 * 默认单个步骤超时时间（30 秒）
 */
const DEFAULT_STEP_TIMEOUT = 30000;

/**
 * Default retry delay (1 second)
 * 默认重试延迟（1 秒）
 */
const DEFAULT_RETRY_DELAY = 1000;

/**
 * Saga Orchestrator Service
 * Saga 编排器服务
 *
 * Executes saga definitions with full compensation support.
 * 执行 Saga 定义，提供完整的补偿支持。
 */
@Injectable()
export class SagaOrchestrator {
  private readonly logger = new Logger(SagaOrchestrator.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly correlationProvider: CorrelationIdProvider,
    private readonly flowTracker: EventFlowTracker,
  ) {}

  /**
   * Execute a saga definition
   * 执行 Saga 定义
   *
   * @param saga - Saga definition to execute
   * @param input - Initial input for the saga
   * @param options - Optional execution configuration
   * @returns Saga execution result
   */
  async execute<TInput, TOutput>(
    saga: SagaDefinition<TInput, TOutput>,
    input: TInput,
    options?: SagaExecutionOptions,
  ): Promise<SagaResult<TOutput>> {
    const context = this.createContext(saga.id, options);
    const stepDurations: Record<string, number> = {};

    this.logger.log(
      `Starting saga: ${saga.id} [${context.correlationId}]`,
    );

    // Emit saga started event
    this.emitSagaEvent("saga.started", {
      sagaId: saga.id,
      correlationId: context.correlationId,
      input,
      timestamp: Date.now(),
    });

    // Track flow start
    this.flowTracker.getOrCreateFlow(context.correlationId, saga.id);

    try {
      // Execute saga with overall timeout
      const sagaTimeout = options?.timeout ?? saga.timeout ?? DEFAULT_SAGA_TIMEOUT;

      const result = await this.withTimeout(
        this.executeSteps(saga, input, context, stepDurations, options),
        sagaTimeout,
        `Saga ${saga.id} timed out after ${sagaTimeout}ms`,
      );

      // Update context status
      context.status = SagaStatus.COMPLETED;

      // Call onComplete callback
      if (saga.onComplete) {
        try {
          await saga.onComplete(result as TOutput, context);
        } catch (error) {
          this.logger.warn(
            `onComplete callback failed for saga ${saga.id}: ${error.message}`,
          );
        }
      }

      // Emit saga completed event
      const duration = Date.now() - context.startTime;
      this.emitSagaEvent("saga.completed", {
        sagaId: saga.id,
        correlationId: context.correlationId,
        duration,
        stepCount: context.executedSteps.length,
        timestamp: Date.now(),
      });

      this.logger.log(
        `Saga completed successfully: ${saga.id} [${context.correlationId}] (${duration}ms)`,
      );

      return {
        success: true,
        result: result as TOutput,
        status: SagaStatus.COMPLETED,
        correlationId: context.correlationId,
        executedSteps: context.executedSteps,
        compensatedSteps: [],
        duration,
        stepDurations,
      };

    } catch (error) {
      // Saga failed - execute compensation
      this.logger.error(
        `Saga failed: ${saga.id} [${context.correlationId}] - ${error.message}`,
      );

      context.status = SagaStatus.COMPENSATING;

      // Execute compensation
      const { compensatedSteps, compensationErrors } = await this.executeCompensation(
        saga,
        context,
      );

      // Determine final status
      const finalStatus = compensationErrors.length > 0
        ? SagaStatus.COMPENSATION_FAILED
        : SagaStatus.FAILED;

      context.status = finalStatus;

      // Call failure callbacks
      if (finalStatus === SagaStatus.COMPENSATION_FAILED && saga.onCompensationFailed) {
        try {
          await saga.onCompensationFailed(error, compensationErrors, context);
        } catch (callbackError) {
          this.logger.warn(
            `onCompensationFailed callback failed: ${callbackError.message}`,
          );
        }
      } else if (saga.onFailed) {
        try {
          await saga.onFailed(error, context);
        } catch (callbackError) {
          this.logger.warn(
            `onFailed callback failed: ${callbackError.message}`,
          );
        }
      }

      // Emit saga failed event
      const duration = Date.now() - context.startTime;
      this.emitSagaEvent("saga.failed", {
        sagaId: saga.id,
        correlationId: context.correlationId,
        error: error.message,
        executedSteps: context.executedSteps,
        compensatedSteps,
        duration,
        timestamp: Date.now(),
      });

      this.logger.warn(
        `Saga failed with compensation: ${saga.id} [${context.correlationId}] ` +
        `executed=${context.executedSteps.length}, compensated=${compensatedSteps.length}`,
      );

      return {
        success: false,
        error,
        status: finalStatus,
        correlationId: context.correlationId,
        executedSteps: context.executedSteps,
        compensatedSteps,
        compensationErrors: compensationErrors.length > 0 ? compensationErrors : undefined,
        duration,
        stepDurations,
      };
    }
  }

  /**
   * Execute all saga steps in sequence
   * 按顺序执行所有 Saga 步骤
   */
  private async executeSteps<TInput>(
    saga: SagaDefinition<TInput, unknown>,
    input: TInput,
    context: SagaContext,
    stepDurations: Record<string, number>,
    options?: SagaExecutionOptions,
  ): Promise<unknown> {
    let currentInput: unknown = input;

    for (const step of saga.steps) {
      // Check if step should be skipped
      if (options?.skipSteps?.includes(step.id)) {
        this.logger.debug(`Skipping step ${step.id} as requested`);

        // Use preloaded result if available
        if (options?.preloadResults?.has(step.id)) {
          currentInput = options.preloadResults.get(step.id);
          context.stepResults.set(step.id, currentInput);
        }
        continue;
      }

      // Execute step
      const stepStartTime = Date.now();

      this.emitSagaEvent("saga.step.started", {
        sagaId: saga.id,
        stepId: step.id,
        stepName: step.name,
        correlationId: context.correlationId,
        timestamp: stepStartTime,
      });

      try {
        currentInput = await this.executeStepWithRetry(step, currentInput, context, saga.id);

        // Record step result
        context.executedSteps.push(step.id);
        context.stepResults.set(step.id, currentInput);

        const stepDuration = Date.now() - stepStartTime;
        stepDurations[step.id] = stepDuration;

        this.emitSagaEvent("saga.step.completed", {
          sagaId: saga.id,
          stepId: step.id,
          stepName: step.name,
          correlationId: context.correlationId,
          duration: stepDuration,
          timestamp: Date.now(),
        });

        this.logger.debug(
          `Step completed: ${step.name} [${step.id}] (${stepDuration}ms)`,
        );

      } catch (error) {
        const stepDuration = Date.now() - stepStartTime;
        stepDurations[step.id] = stepDuration;

        // Handle based on error strategy
        const errorStrategy = step.onError ?? SagaStepErrorStrategy.FAIL;

        if (errorStrategy === SagaStepErrorStrategy.SKIP) {
          this.logger.warn(
            `Step ${step.id} failed but skipping as per strategy: ${error.message}`,
          );
          context.executedSteps.push(step.id);
          continue;
        }

        // For FAIL and RETRY (after retries exhausted), propagate error
        throw error;
      }
    }

    return currentInput;
  }

  /**
   * Execute a single step with retry logic
   * 使用重试逻辑执行单个步骤
   */
  private async executeStepWithRetry<TInput, TOutput>(
    step: SagaStep<TInput, TOutput>,
    input: TInput,
    context: SagaContext,
    sagaId: string,
  ): Promise<TOutput> {
    const maxRetries = step.retries ?? 0;
    const retryDelay = step.retryDelay ?? DEFAULT_RETRY_DELAY;
    const stepTimeout = step.timeout ?? DEFAULT_STEP_TIMEOUT;

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Execute with timeout
        const result = await this.withTimeout(
          step.execute(input, context),
          stepTimeout,
          `Step ${step.id} timed out after ${stepTimeout}ms`,
        );

        return result;

      } catch (error) {
        lastError = error;
        const willRetry = attempt < maxRetries;

        this.emitSagaEvent("saga.step.failed", {
          sagaId,
          stepId: step.id,
          stepName: step.name,
          correlationId: context.correlationId,
          error: error.message,
          attempt: attempt + 1,
          willRetry,
          timestamp: Date.now(),
        });

        if (willRetry) {
          const delay = retryDelay * Math.pow(2, attempt);
          this.logger.warn(
            `Step ${step.id} failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
            `retrying in ${delay}ms: ${error.message}`,
          );
          await this.delay(delay);
        } else {
          this.logger.error(
            `Step ${step.id} failed after ${maxRetries + 1} attempts: ${error.message}`,
          );
        }
      }
    }

    throw lastError!;
  }

  /**
   * Execute compensation for all executed steps in reverse order
   * 按逆序执行所有已执行步骤的补偿
   */
  private async executeCompensation(
    saga: SagaDefinition<unknown, unknown>,
    context: SagaContext,
  ): Promise<{
    compensatedSteps: string[];
    compensationErrors: CompensationError[];
  }> {
    const compensatedSteps: string[] = [];
    const compensationErrors: CompensationError[] = [];

    // Get steps to compensate in reverse order
    const stepsToCompensate = [...context.executedSteps].reverse();

    if (stepsToCompensate.length === 0) {
      return { compensatedSteps, compensationErrors };
    }

    this.emitSagaEvent("saga.compensation.started", {
      sagaId: saga.id,
      correlationId: context.correlationId,
      stepsToCompensate,
      timestamp: Date.now(),
    });

    this.logger.log(
      `Starting compensation for ${stepsToCompensate.length} steps [${context.correlationId}]`,
    );

    for (const stepId of stepsToCompensate) {
      const step = saga.steps.find((s) => s.id === stepId);

      if (!step) {
        this.logger.warn(`Step ${stepId} not found in saga definition`);
        continue;
      }

      // Skip if step has no compensate function
      if (!step.compensate) {
        this.logger.debug(`Step ${stepId} has no compensation function, skipping`);
        continue;
      }

      // Skip if step is not critical
      if (step.critical === false) {
        this.logger.debug(`Step ${stepId} is not critical, skipping compensation`);
        continue;
      }

      try {
        // Get the input that was passed to this step
        const stepIndex = saga.steps.findIndex((s) => s.id === stepId);
        const previousStepId = stepIndex > 0 ? saga.steps[stepIndex - 1].id : null;
        const stepInput = previousStepId
          ? context.stepResults.get(previousStepId)
          : context.metadata.originalInput;

        // Get the output from this step
        const stepOutput = context.stepResults.get(stepId);

        this.logger.debug(`Compensating step: ${step.name} [${stepId}]`);

        await step.compensate(stepInput, stepOutput, context);

        compensatedSteps.push(stepId);
        context.compensatedSteps.push(stepId);

        this.emitSagaEvent("saga.step.compensated", {
          sagaId: saga.id,
          stepId: step.id,
          stepName: step.name,
          correlationId: context.correlationId,
          timestamp: Date.now(),
        });

        this.logger.debug(`Step compensated successfully: ${step.name} [${stepId}]`);

      } catch (error) {
        this.logger.error(
          `Compensation failed for step ${stepId}: ${error.message}`,
          error.stack,
        );

        compensationErrors.push({
          stepId,
          stepName: step.name,
          error,
          timestamp: Date.now(),
        });

        // Continue compensating other steps even if one fails
      }
    }

    return { compensatedSteps, compensationErrors };
  }

  /**
   * Create saga execution context
   * 创建 Saga 执行上下文
   */
  private createContext(sagaId: string, options?: SagaExecutionOptions): SagaContext {
    const correlationId = options?.correlationId
      ?? this.correlationProvider.getCorrelationId()
      ?? uuidv4();

    const rootCorrelationId = this.correlationProvider.getRootCorrelationId() ?? correlationId;

    const stepResults = options?.preloadResults ?? new Map<string, unknown>();

    return {
      correlationId,
      rootCorrelationId,
      startTime: Date.now(),
      status: SagaStatus.RUNNING,
      stepResults,
      executedSteps: [],
      compensatedSteps: [],
      metadata: {
        sagaId,
        ...options?.metadata,
      },

      getStepResult<T>(stepId: string): T | undefined {
        return stepResults.get(stepId) as T | undefined;
      },

      setMetadata(key: string, value: unknown): void {
        this.metadata[key] = value;
      },
    };
  }

  /**
   * Emit saga event through event emitter
   * 通过事件发射器发出 Saga 事件
   */
  private emitSagaEvent(eventName: string, payload: Record<string, unknown>): void {
    try {
      this.eventEmitter.emit(eventName, payload);
    } catch (error) {
      this.logger.warn(`Failed to emit event ${eventName}: ${error.message}`);
    }
  }

  /**
   * Execute a promise with timeout
   * 带超时执行 Promise
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    message: string,
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(message));
      }, ms);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  /**
   * Delay execution
   * 延迟执行
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
