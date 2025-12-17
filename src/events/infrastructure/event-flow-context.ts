/**
 * Event Flow Context
 * 事件流上下文
 *
 * Tracks the flow of events through the system for debugging and monitoring.
 * Maintains a record of all events in a chain, their handlers, and timing.
 *
 * 追踪系统中的事件流用于调试和监控。
 * 维护链中所有事件、其处理器和时间的记录。
 */

import { Injectable, Logger } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

/**
 * Status of an event in the flow
 * 流中事件的状态
 */
export enum EventFlowStatus {
  PENDING = "pending", // Event emitted, waiting for handlers (事件已发出，等待处理器)
  IN_PROGRESS = "in_progress", // Handler(s) currently processing (处理器正在处理)
  COMPLETED = "completed", // All handlers completed successfully (所有处理器成功完成)
  FAILED = "failed", // One or more handlers failed (一个或多个处理器失败)
  PARTIAL = "partial", // Some handlers succeeded, some failed (部分处理器成功，部分失败)
}

/**
 * Individual event record in the flow
 * 流中的单个事件记录
 */
export interface EventFlowRecord {
  /**
   * Unique ID for this event occurrence
   * 此事件发生的唯一ID
   */
  id: string;

  /**
   * Event name/type
   * 事件名称/类型
   */
  eventName: string;

  /**
   * Correlation ID linking this to the request chain
   * 将此链接到请求链的关联ID
   */
  correlationId: string;

  /**
   * Causation ID - which event caused this one
   * 因果ID - 哪个事件导致了这个事件
   */
  causationId?: string;

  /**
   * Event payload (may be truncated for large payloads)
   * 事件负载（大负载可能被截断）
   */
  payload: unknown;

  /**
   * Timestamp when event was emitted
   * 事件发出时的时间戳
   */
  emittedAt: number;

  /**
   * Timestamp when processing started
   * 处理开始时的时间戳
   */
  startedAt?: number;

  /**
   * Timestamp when processing completed
   * 处理完成时的时间戳
   */
  completedAt?: number;

  /**
   * Current status of this event
   * 此事件的当前状态
   */
  status: EventFlowStatus;

  /**
   * Producer that emitted this event
   * 发出此事件的生产者
   */
  producer: string;

  /**
   * Handler results for this event
   * 此事件的处理器结果
   */
  handlers: EventHandlerResult[];

  /**
   * Depth in the event chain (0 = root)
   * 事件链中的深度（0 = 根）
   */
  depth: number;

  /**
   * Child events triggered by this event
   * 此事件触发的子事件
   */
  triggeredEvents: string[];

  /**
   * Error if event processing failed
   * 如果事件处理失败则记录错误
   */
  error?: {
    message: string;
    stack?: string;
    handler?: string;
  };
}

/**
 * Result from an individual event handler
 * 单个事件处理器的结果
 */
export interface EventHandlerResult {
  /**
   * Handler name
   * 处理器名称
   */
  handler: string;

  /**
   * Whether the handler succeeded
   * 处理器是否成功
   */
  success: boolean;

  /**
   * Start timestamp
   * 开始时间戳
   */
  startedAt: number;

  /**
   * Completion timestamp
   * 完成时间戳
   */
  completedAt?: number;

  /**
   * Duration in milliseconds
   * 持续时间（毫秒）
   */
  duration?: number;

  /**
   * Error message if failed
   * 如果失败则记录错误消息
   */
  error?: string;

  /**
   * Whether handler was async
   * 处理器是否为异步
   */
  async: boolean;
}

/**
 * Complete flow context for a correlation chain
 * 关联链的完整流上下文
 */
export interface EventFlowContextData {
  /**
   * Root correlation ID
   * 根关联ID
   */
  rootCorrelationId: string;

  /**
   * All events in this flow
   * 此流中的所有事件
   */
  events: Map<string, EventFlowRecord>;

  /**
   * Flow start time
   * 流开始时间
   */
  startTime: number;

  /**
   * Flow end time (when last event completes)
   * 流结束时间（最后一个事件完成时）
   */
  endTime?: number;

  /**
   * Total event count
   * 事件总数
   */
  eventCount: number;

  /**
   * Maximum depth reached
   * 达到的最大深度
   */
  maxDepth: number;

  /**
   * Origin of the flow (HTTP request path, event name, etc.)
   * 流的来源（HTTP请求路径、事件名称等）
   */
  origin: string;
}

/**
 * Injectable service for tracking event flows
 * 用于追踪事件流的可注入服务
 */
@Injectable()
export class EventFlowTracker {
  private readonly logger = new Logger(EventFlowTracker.name);

  /**
   * Active flows indexed by root correlation ID
   * 按根关联ID索引的活动流
   */
  private readonly activeFlows = new Map<string, EventFlowContextData>();

  /**
   * Completed flows (kept for a limited time for debugging)
   * 已完成的流（保留有限时间用于调试）
   */
  private readonly completedFlows: EventFlowContextData[] = [];

  /**
   * Maximum completed flows to keep in memory
   * 内存中保留的最大已完成流数量
   */
  private readonly maxCompletedFlows = 100;

  /**
   * Get or create a flow context for a correlation chain
   * 获取或创建关联链的流上下文
   *
   * @param rootCorrelationId - Root correlation ID
   * @param origin - Origin of the flow
   * @returns The flow context
   */
  getOrCreateFlow(
    rootCorrelationId: string,
    origin: string,
  ): EventFlowContextData {
    let flow = this.activeFlows.get(rootCorrelationId);

    if (!flow) {
      flow = {
        rootCorrelationId,
        events: new Map(),
        startTime: Date.now(),
        eventCount: 0,
        maxDepth: 0,
        origin,
      };
      this.activeFlows.set(rootCorrelationId, flow);
      this.logger.debug(`Created new event flow: ${rootCorrelationId}`);
    }

    return flow;
  }

  /**
   * Record an event being emitted
   * 记录事件被发出
   *
   * @param eventName - Event name
   * @param correlationId - This event's correlation ID
   * @param causationId - Parent event's correlation ID
   * @param rootCorrelationId - Root correlation ID
   * @param payload - Event payload
   * @param producer - Event producer
   * @param depth - Event chain depth
   * @returns The event record
   */
  recordEventEmitted(
    eventName: string,
    correlationId: string,
    causationId: string | undefined,
    rootCorrelationId: string,
    payload: unknown,
    producer: string,
    depth: number,
  ): EventFlowRecord {
    const flow = this.getOrCreateFlow(rootCorrelationId, eventName);

    const record: EventFlowRecord = {
      id: uuidv4(),
      eventName,
      correlationId,
      causationId,
      payload: this.truncatePayload(payload),
      emittedAt: Date.now(),
      status: EventFlowStatus.PENDING,
      producer,
      handlers: [],
      depth,
      triggeredEvents: [],
    };

    flow.events.set(correlationId, record);
    flow.eventCount++;
    flow.maxDepth = Math.max(flow.maxDepth, depth);

    // Update parent event's triggered events list
    if (causationId) {
      const parentRecord = flow.events.get(causationId);
      if (parentRecord) {
        parentRecord.triggeredEvents.push(correlationId);
      }
    }

    this.logger.debug(
      `Event emitted: ${eventName} [${correlationId}] depth=${depth}`,
    );

    return record;
  }

  /**
   * Record that a handler started processing an event
   * 记录处理器开始处理事件
   *
   * @param correlationId - Event correlation ID
   * @param rootCorrelationId - Root correlation ID
   * @param handlerName - Handler name
   * @param isAsync - Whether handler is async
   */
  recordHandlerStarted(
    correlationId: string,
    rootCorrelationId: string,
    handlerName: string,
    isAsync: boolean,
  ): void {
    const flow = this.activeFlows.get(rootCorrelationId);
    const record = flow?.events.get(correlationId);

    if (record) {
      if (record.status === EventFlowStatus.PENDING) {
        record.status = EventFlowStatus.IN_PROGRESS;
        record.startedAt = Date.now();
      }

      record.handlers.push({
        handler: handlerName,
        success: false, // Will be updated on completion
        startedAt: Date.now(),
        async: isAsync,
      });

      this.logger.debug(
        `Handler started: ${handlerName} for ${record.eventName} [${correlationId}]`,
      );
    }
  }

  /**
   * Record that a handler completed processing
   * 记录处理器完成处理
   *
   * @param correlationId - Event correlation ID
   * @param rootCorrelationId - Root correlation ID
   * @param handlerName - Handler name
   * @param success - Whether handler succeeded
   * @param error - Error message if failed
   */
  recordHandlerCompleted(
    correlationId: string,
    rootCorrelationId: string,
    handlerName: string,
    success: boolean,
    error?: string,
  ): void {
    const flow = this.activeFlows.get(rootCorrelationId);
    const record = flow?.events.get(correlationId);

    if (record) {
      const handlerResult = record.handlers.find(
        (h) => h.handler === handlerName && !h.completedAt,
      );

      if (handlerResult) {
        handlerResult.success = success;
        handlerResult.completedAt = Date.now();
        handlerResult.duration = handlerResult.completedAt - handlerResult.startedAt;
        if (error) {
          handlerResult.error = error;
        }

        this.logger.debug(
          `Handler completed: ${handlerName} for ${record.eventName} ` +
            `[${correlationId}] success=${success} duration=${handlerResult.duration}ms`,
        );
      }

      // Update event status based on all handlers
      this.updateEventStatus(record);
    }
  }

  /**
   * Record that an event processing completed
   * 记录事件处理完成
   *
   * @param correlationId - Event correlation ID
   * @param rootCorrelationId - Root correlation ID
   */
  recordEventCompleted(
    correlationId: string,
    rootCorrelationId: string,
  ): void {
    const flow = this.activeFlows.get(rootCorrelationId);
    const record = flow?.events.get(correlationId);

    if (record && record.status !== EventFlowStatus.COMPLETED) {
      record.completedAt = Date.now();
      this.updateEventStatus(record);

      const duration = record.completedAt - record.emittedAt;
      this.logger.debug(
        `Event completed: ${record.eventName} [${correlationId}] ` +
          `status=${record.status} duration=${duration}ms`,
      );

      // Check if flow is complete
      this.checkFlowCompletion(rootCorrelationId);
    }
  }

  /**
   * Record that an event failed
   * 记录事件失败
   *
   * @param correlationId - Event correlation ID
   * @param rootCorrelationId - Root correlation ID
   * @param error - Error details
   * @param handler - Handler that failed
   */
  recordEventFailed(
    correlationId: string,
    rootCorrelationId: string,
    error: Error,
    handler?: string,
  ): void {
    const flow = this.activeFlows.get(rootCorrelationId);
    const record = flow?.events.get(correlationId);

    if (record) {
      record.status = EventFlowStatus.FAILED;
      record.completedAt = Date.now();
      record.error = {
        message: error.message,
        stack: error.stack,
        handler,
      };

      this.logger.warn(
        `Event failed: ${record.eventName} [${correlationId}] ` +
          `handler=${handler} error=${error.message}`,
      );

      // Check if flow is complete
      this.checkFlowCompletion(rootCorrelationId);
    }
  }

  /**
   * Get a specific event record
   * 获取特定事件记录
   *
   * @param correlationId - Event correlation ID
   * @param rootCorrelationId - Root correlation ID
   * @returns The event record or undefined
   */
  getEventRecord(
    correlationId: string,
    rootCorrelationId: string,
  ): EventFlowRecord | undefined {
    return this.activeFlows.get(rootCorrelationId)?.events.get(correlationId);
  }

  /**
   * Get the complete flow for a correlation chain
   * 获取关联链的完整流
   *
   * @param rootCorrelationId - Root correlation ID
   * @returns The flow context or undefined
   */
  getFlow(rootCorrelationId: string): EventFlowContextData | undefined {
    return (
      this.activeFlows.get(rootCorrelationId) ||
      this.completedFlows.find(
        (f) => f.rootCorrelationId === rootCorrelationId,
      )
    );
  }

  /**
   * Get flow summary for logging
   * 获取用于日志记录的流摘要
   *
   * @param rootCorrelationId - Root correlation ID
   * @returns Summary string
   */
  getFlowSummary(rootCorrelationId: string): string {
    const flow = this.getFlow(rootCorrelationId);
    if (!flow) {
      return `Flow not found: ${rootCorrelationId}`;
    }

    const duration = flow.endTime
      ? flow.endTime - flow.startTime
      : Date.now() - flow.startTime;

    const completedEvents = Array.from(flow.events.values()).filter(
      (e) =>
        e.status === EventFlowStatus.COMPLETED ||
        e.status === EventFlowStatus.FAILED,
    ).length;

    return (
      `Flow ${rootCorrelationId}: ` +
      `events=${flow.eventCount} completed=${completedEvents} ` +
      `maxDepth=${flow.maxDepth} duration=${duration}ms`
    );
  }

  /**
   * Get Mermaid sequence diagram for a flow
   * 获取流的Mermaid序列图
   *
   * @param rootCorrelationId - Root correlation ID
   * @returns Mermaid diagram syntax
   */
  generateFlowDiagram(rootCorrelationId: string): string {
    const flow = this.getFlow(rootCorrelationId);
    if (!flow) {
      return "Flow not found";
    }

    const lines: string[] = ["sequenceDiagram"];
    const events = Array.from(flow.events.values()).sort(
      (a, b) => a.emittedAt - b.emittedAt,
    );

    events.forEach((event) => {
      const status = event.status === EventFlowStatus.FAILED ? "X" : "";
      lines.push(
        `    ${event.producer}->>${event.handlers[0]?.handler || "Handler"}: ${event.eventName}${status}`,
      );
    });

    return lines.join("\n");
  }

  /**
   * Update event status based on handler results
   * 根据处理器结果更新事件状态
   */
  private updateEventStatus(record: EventFlowRecord): void {
    if (record.handlers.length === 0) {
      return;
    }

    const allCompleted = record.handlers.every((h) => h.completedAt);
    if (!allCompleted) {
      record.status = EventFlowStatus.IN_PROGRESS;
      return;
    }

    const allSucceeded = record.handlers.every((h) => h.success);
    const allFailed = record.handlers.every((h) => !h.success);

    if (allSucceeded) {
      record.status = EventFlowStatus.COMPLETED;
    } else if (allFailed) {
      record.status = EventFlowStatus.FAILED;
    } else {
      record.status = EventFlowStatus.PARTIAL;
    }
  }

  /**
   * Check if a flow is complete and archive it
   * 检查流是否完成并归档
   */
  private checkFlowCompletion(rootCorrelationId: string): void {
    const flow = this.activeFlows.get(rootCorrelationId);
    if (!flow) return;

    const allComplete = Array.from(flow.events.values()).every(
      (e) =>
        e.status === EventFlowStatus.COMPLETED ||
        e.status === EventFlowStatus.FAILED ||
        e.status === EventFlowStatus.PARTIAL,
    );

    if (allComplete && flow.events.size > 0) {
      flow.endTime = Date.now();
      this.activeFlows.delete(rootCorrelationId);
      this.completedFlows.unshift(flow);

      // Trim completed flows if over limit
      if (this.completedFlows.length > this.maxCompletedFlows) {
        this.completedFlows.pop();
      }

      this.logger.log(
        `Flow completed: ${this.getFlowSummary(rootCorrelationId)}`,
      );
    }
  }

  /**
   * Truncate large payloads for storage
   * 截断大负载以便存储
   */
  private truncatePayload(payload: unknown): unknown {
    const json = JSON.stringify(payload);
    if (json.length > 1000) {
      return {
        _truncated: true,
        _originalLength: json.length,
        _preview: json.substring(0, 500) + "...",
      };
    }
    return payload;
  }

  /**
   * Get statistics about active and completed flows
   * 获取有关活动和已完成流的统计信息
   */
  getStats(): {
    activeFlows: number;
    completedFlows: number;
    totalEvents: number;
    avgEventsPerFlow: number;
  } {
    const activeCount = this.activeFlows.size;
    const completedCount = this.completedFlows.length;
    const totalEvents =
      Array.from(this.activeFlows.values()).reduce(
        (sum, f) => sum + f.eventCount,
        0,
      ) +
      this.completedFlows.reduce((sum, f) => sum + f.eventCount, 0);

    return {
      activeFlows: activeCount,
      completedFlows: completedCount,
      totalEvents,
      avgEventsPerFlow:
        activeCount + completedCount > 0
          ? totalEvents / (activeCount + completedCount)
          : 0,
    };
  }

  /**
   * Clear old completed flows (for memory management)
   * 清除旧的已完成流（用于内存管理）
   */
  clearOldFlows(maxAgeMs: number = 3600000): number {
    const cutoff = Date.now() - maxAgeMs;
    const before = this.completedFlows.length;

    const filtered = this.completedFlows.filter(
      (f) => f.endTime && f.endTime > cutoff,
    );
    this.completedFlows.length = 0;
    this.completedFlows.push(...filtered);

    return before - this.completedFlows.length;
  }
}
