/**
 * Enhanced Event Bus
 * 增强事件总线
 *
 * Wraps EventEmitter2 with additional capabilities:
 * - Automatic correlation ID injection
 * - Event flow tracking
 * - Event validation against catalog
 * - Debug logging
 * - Metrics collection hooks
 *
 * 包装EventEmitter2并添加额外功能：
 * - 自动关联ID注入
 * - 事件流追踪
 * - 事件目录验证
 * - 调试日志
 * - 指标收集钩子
 */

import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { v4 as uuidv4 } from "uuid";

import {
  CorrelationIdProvider,
  CorrelationContext,
} from "./correlation-id.provider";
import {
  EventFlowTracker,
  EventFlowStatus,
  EventFlowRecord,
} from "./event-flow-context";
import {
  EventCatalog,
  EventCatalogEntry,
  getEventEntry,
} from "@events/catalog";

/**
 * Enhanced event metadata attached to all events
 * 附加到所有事件的增强事件元数据
 */
export interface EnhancedEventMetadata {
  /**
   * Unique ID for this event instance
   * 此事件实例的唯一ID
   */
  eventId: string;

  /**
   * Correlation ID for tracing
   * 用于追踪的关联ID
   */
  correlationId: string;

  /**
   * Causation ID - parent event that caused this one
   * 因果ID - 导致此事件的父事件
   */
  causationId?: string;

  /**
   * Root correlation ID for the entire chain
   * 整个链的根关联ID
   */
  rootCorrelationId: string;

  /**
   * Depth in the event chain
   * 事件链中的深度
   */
  depth: number;

  /**
   * Timestamp when event was emitted
   * 事件发出时的时间戳
   */
  timestamp: number;

  /**
   * Producer that emitted this event
   * 发出此事件的生产者
   */
  producer: string;

  /**
   * User ID if in authenticated context
   * 认证上下文中的用户ID
   */
  userId?: string;
}

/**
 * Enhanced event wrapper with metadata
 * 带有元数据的增强事件包装器
 */
export interface EnhancedEvent<T = unknown> {
  /**
   * Event metadata
   * 事件元数据
   */
  metadata: EnhancedEventMetadata;

  /**
   * Original event payload
   * 原始事件负载
   */
  payload: T;
}

/**
 * Event emission options
 * 事件发射选项
 */
export interface EmitOptions {
  /**
   * Custom producer name (defaults to class name of caller)
   * 自定义生产者名称（默认为调用者的类名）
   */
  producer?: string;

  /**
   * Skip validation against catalog
   * 跳过目录验证
   */
  skipValidation?: boolean;

  /**
   * Skip flow tracking (for high-frequency events)
   * 跳过流追踪（用于高频事件）
   */
  skipTracking?: boolean;

  /**
   * Additional metadata
   * 附加元数据
   */
  additionalMetadata?: Record<string, unknown>;
}

/**
 * Validation result for an event
 * 事件的验证结果
 */
export interface EventValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  catalogEntry?: EventCatalogEntry;
}

/**
 * Event emission result
 * 事件发射结果
 */
export interface EmitResult {
  /**
   * Whether emission was successful
   * 发射是否成功
   */
  success: boolean;

  /**
   * Generated event ID
   * 生成的事件ID
   */
  eventId: string;

  /**
   * Correlation ID used
   * 使用的关联ID
   */
  correlationId: string;

  /**
   * Validation result
   * 验证结果
   */
  validation?: EventValidationResult;

  /**
   * Error if emission failed
   * 如果发射失败则记录错误
   */
  error?: string;
}

/**
 * Injectable enhanced event bus service
 * 可注入的增强事件总线服务
 */
@Injectable()
export class EnhancedEventBus implements OnModuleDestroy {
  private readonly logger = new Logger(EnhancedEventBus.name);

  /**
   * Whether to enable strict validation (fail on unknown events)
   * 是否启用严格验证（对未知事件失败）
   */
  private strictValidation = false;

  /**
   * Whether to enable flow tracking globally
   * 是否全局启用流追踪
   */
  private trackingEnabled = true;

  /**
   * Events to skip tracking for (high-frequency events)
   * 跳过追踪的事件（高频事件）
   */
  private skipTrackingEvents = new Set<string>();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly correlationProvider: CorrelationIdProvider,
    private readonly flowTracker: EventFlowTracker,
  ) {
    this.logger.log("EnhancedEventBus initialized");
  }

  /**
   * Emit an event with automatic correlation and tracking
   * 发射带有自动关联和追踪的事件
   *
   * @param eventName - Name of the event to emit
   * @param payload - Event payload
   * @param options - Emission options
   * @returns Emission result
   */
  async emit<T = unknown>(
    eventName: string,
    payload: T,
    options: EmitOptions = {},
  ): Promise<EmitResult> {
    const eventId = uuidv4();
    const producer = options.producer || "EnhancedEventBus";

    // Get or create correlation context
    const parentContext = this.correlationProvider.getContext();

    // Each emitted event gets a unique correlationId; the chain is held by rootCorrelationId + causationId.
    const correlationId = uuidv4();
    const causationId = parentContext?.correlationId;
    const rootCorrelationId = parentContext?.rootCorrelationId || correlationId;
    const depth = parentContext ? parentContext.depth + 1 : 0;
    const userId = parentContext?.userId;

    // Validate event against catalog
    let validation: EventValidationResult | undefined;
    if (!options.skipValidation) {
      validation = this.validateEvent(eventName, payload);

      if (!validation.valid && this.strictValidation) {
        this.logger.error(
          `Event validation failed for ${eventName}: ${validation.errors.join(", ")}`,
        );
        return {
          success: false,
          eventId,
          correlationId,
          validation,
          error: `Validation failed: ${validation.errors.join(", ")}`,
        };
      }

      if (!validation.valid) {
        this.logger.warn(
          `Event validation errors for ${eventName}: ${validation.errors.join(", ")}`,
        );
      }

      if (validation.warnings.length > 0) {
        this.logger.warn(
          `Event validation warnings for ${eventName}: ${validation.warnings.join(", ")}`,
        );
      }
    }

    // Create enhanced event metadata
    const metadata: EnhancedEventMetadata = {
      eventId,
      correlationId,
      causationId,
      rootCorrelationId,
      depth,
      timestamp: Date.now(),
      producer,
      userId,
      ...options.additionalMetadata,
    };

    // Create enhanced event wrapper
    const enhancedEvent: EnhancedEvent<T> = {
      metadata,
      payload,
    };

    // Track event emission
    let flowRecord: EventFlowRecord | undefined;
    if (this.shouldTrackEvent(eventName, options)) {
      flowRecord = this.flowTracker.recordEventEmitted(
        eventName,
        correlationId,
        causationId,
        rootCorrelationId,
        payload,
        producer,
        depth,
      );
    }

    this.logger.debug(
      `Emitting event: ${eventName} [${correlationId}] depth=${depth}`,
    );

    try {
      // Run event handlers in correlation context
      await this.correlationProvider.runWithCorrelationAsync(async () => {
        // Emit both enhanced and original formats for backward compatibility
        // Enhanced format with metadata
        this.eventEmitter.emit(`${eventName}:enhanced`, enhancedEvent);

        // Original format (for existing @OnEvent handlers)
        // Attach metadata as a hidden property
        const payloadWithMetadata = this.attachMetadata(payload, metadata);
        this.eventEmitter.emit(eventName, payloadWithMetadata);
      }, {
        correlationId,
        causationId,
        rootCorrelationId,
        depth,
        origin: eventName,
        userId,
      });

      // Mark event as completed in tracking
      if (flowRecord) {
        this.flowTracker.recordEventCompleted(correlationId, rootCorrelationId);
      }

      return {
        success: true,
        eventId,
        correlationId,
        validation,
      };
    } catch (error) {
      // Record failure in tracking
      if (flowRecord) {
        this.flowTracker.recordEventFailed(
          correlationId,
          rootCorrelationId,
          error as Error,
        );
      }

      this.logger.error(
        `Event emission failed: ${eventName} [${correlationId}] - ${(error as Error).message}`,
      );

      return {
        success: false,
        eventId,
        correlationId,
        validation,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Emit event synchronously (for legacy compatibility)
   * 同步发射事件（用于遗留兼容性）
   *
   * @param eventName - Event name
   * @param payload - Event payload
   * @param options - Emission options
   * @returns Correlation ID used
   */
  emitSync<T = unknown>(
    eventName: string,
    payload: T,
    options: EmitOptions = {},
  ): string {
    const eventId = uuidv4();
    const producer = options.producer || "EnhancedEventBus";

    const parentContext = this.correlationProvider.getContext();
    const correlationId = uuidv4();
    const causationId = parentContext?.correlationId;
    const rootCorrelationId = parentContext?.rootCorrelationId || correlationId;
    const depth = parentContext ? parentContext.depth + 1 : 0;

    const metadata: EnhancedEventMetadata = {
      eventId,
      correlationId,
      causationId,
      rootCorrelationId,
      depth,
      timestamp: Date.now(),
      producer,
      userId: parentContext?.userId,
    };

    const shouldTrack = this.shouldTrackEvent(eventName, options);
    if (shouldTrack) {
      this.flowTracker.recordEventEmitted(
        eventName,
        correlationId,
        causationId,
        rootCorrelationId,
        payload,
        producer,
        depth,
      );
    }

    const payloadWithMetadata = this.attachMetadata(payload, metadata);
    try {
      this.correlationProvider.runWithCorrelation(
        () => {
          this.eventEmitter.emit(eventName, payloadWithMetadata);
        },
        {
          correlationId,
          causationId,
          rootCorrelationId,
          depth,
          origin: eventName,
          userId: parentContext?.userId,
        },
      );

      if (shouldTrack) {
        this.flowTracker.recordEventCompleted(correlationId, rootCorrelationId);
      }
    } catch (error) {
      if (shouldTrack) {
        this.flowTracker.recordEventFailed(
          correlationId,
          rootCorrelationId,
          error as Error,
        );
      }

      this.logger.error(
        `Event emission failed (sync): ${eventName} [${correlationId}] - ${(error as Error).message}`,
      );
      throw error;
    }

    this.logger.debug(
      `Event emitted (sync): ${eventName} [${correlationId}]`,
    );

    return correlationId;
  }

  /**
   * Validate an event against the catalog
   * 根据目录验证事件
   *
   * @param eventName - Event name
   * @param payload - Event payload
   * @returns Validation result
   */
  validateEvent(eventName: string, payload: unknown): EventValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const catalogEntry = getEventEntry(eventName);

    if (!catalogEntry) {
      errors.push(`Event "${eventName}" not found in catalog`);
      return { valid: false, errors, warnings };
    }

    // Check if event is deprecated
    if (catalogEntry.deprecated) {
      warnings.push(
        `Event "${eventName}" is deprecated: ${catalogEntry.deprecationMessage || "No migration path provided"}`,
      );
    }

    // Validate payload exists
    if (payload === undefined || payload === null) {
      warnings.push(`Event "${eventName}" has no payload`);
    }

    // Check payload type (basic validation)
    if (catalogEntry.payloadType && payload !== null) {
      // For now, just check it's an object for complex types
      if (
        !catalogEntry.payloadType.startsWith("string") &&
        !catalogEntry.payloadType.startsWith("number") &&
        typeof payload !== "object"
      ) {
        warnings.push(
          `Event "${eventName}" expected object payload, got ${typeof payload}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      catalogEntry,
    };
  }

  /**
   * Check if event should be tracked
   * 检查事件是否应该被追踪
   */
  private shouldTrackEvent(eventName: string, options: EmitOptions): boolean {
    if (options.skipTracking) return false;
    if (!this.trackingEnabled) return false;
    if (this.skipTrackingEvents.has(eventName)) return false;
    return true;
  }

  /**
   * Attach metadata to payload for backward compatibility
   * 将元数据附加到负载以实现向后兼容
   */
  private attachMetadata<T>(
    payload: T,
    metadata: EnhancedEventMetadata,
  ): T & { __eventMetadata?: EnhancedEventMetadata } {
    if (typeof payload === "object" && payload !== null) {
      return {
        ...payload,
        __eventMetadata: metadata,
      };
    }
    return payload as T & { __eventMetadata?: EnhancedEventMetadata };
  }

  /**
   * Extract metadata from payload (for handlers)
   * 从负载中提取元数据（用于处理器）
   *
   * @param payload - Event payload that may contain metadata
   * @returns Extracted metadata or undefined
   */
  static extractMetadata(
    payload: unknown,
  ): EnhancedEventMetadata | undefined {
    if (
      typeof payload === "object" &&
      payload !== null &&
      "__eventMetadata" in payload
    ) {
      return (payload as any).__eventMetadata;
    }
    return undefined;
  }

  /**
   * Get correlation ID from event payload
   * 从事件负载获取关联ID
   *
   * @param payload - Event payload
   * @returns Correlation ID or undefined
   */
  static getCorrelationId(payload: unknown): string | undefined {
    return EnhancedEventBus.extractMetadata(payload)?.correlationId;
  }

  /**
   * Enable or disable strict validation
   * 启用或禁用严格验证
   */
  setStrictValidation(enabled: boolean): void {
    this.strictValidation = enabled;
    this.logger.log(`Strict validation ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Enable or disable flow tracking
   * 启用或禁用流追踪
   */
  setTrackingEnabled(enabled: boolean): void {
    this.trackingEnabled = enabled;
    this.logger.log(`Flow tracking ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Add events to skip tracking list
   * 将事件添加到跳过追踪列表
   */
  skipTrackingFor(eventNames: string[]): void {
    eventNames.forEach((name) => this.skipTrackingEvents.add(name));
  }

  /**
   * Get flow tracker instance
   * 获取流追踪器实例
   */
  getFlowTracker(): EventFlowTracker {
    return this.flowTracker;
  }

  /**
   * Get flow summary for debugging
   * 获取用于调试的流摘要
   */
  getFlowSummary(rootCorrelationId: string): string {
    return this.flowTracker.getFlowSummary(rootCorrelationId);
  }

  /**
   * Generate flow diagram
   * 生成流程图
   */
  generateFlowDiagram(rootCorrelationId: string): string {
    return this.flowTracker.generateFlowDiagram(rootCorrelationId);
  }

  /**
   * Get tracking statistics
   * 获取追踪统计信息
   */
  getStats(): ReturnType<EventFlowTracker["getStats"]> {
    return this.flowTracker.getStats();
  }

  /**
   * Cleanup on module destroy
   * 模块销毁时清理
   */
  onModuleDestroy(): void {
    this.logger.log("EnhancedEventBus shutting down");
    // Clear old flows to free memory
    this.flowTracker.clearOldFlows(0);
  }
}

/**
 * Decorator to automatically track handler execution
 * 自动追踪处理器执行的装饰器
 *
 * Usage:
 * @TrackedEventHandler('MyHandler')
 * handleEvent(event: MyEvent) { ... }
 */
export function TrackedEventHandler(handlerName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const payload = args[0];
      const metadata = EnhancedEventBus.extractMetadata(payload);

      // If we have tracking context, record handler execution
      if (metadata) {
        const flowTracker = (this as any).flowTracker as
          | EventFlowTracker
          | undefined;

        if (flowTracker) {
          flowTracker.recordHandlerStarted(
            metadata.correlationId,
            metadata.rootCorrelationId,
            handlerName,
            true,
          );

          try {
            const result = await originalMethod.apply(this, args);
            flowTracker.recordHandlerCompleted(
              metadata.correlationId,
              metadata.rootCorrelationId,
              handlerName,
              true,
            );
            return result;
          } catch (error) {
            flowTracker.recordHandlerCompleted(
              metadata.correlationId,
              metadata.rootCorrelationId,
              handlerName,
              false,
              (error as Error).message,
            );
            throw error;
          }
        }
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
