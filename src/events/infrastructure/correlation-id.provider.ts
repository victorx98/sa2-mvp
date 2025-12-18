/**
 * Correlation ID Provider
 * 关联ID提供器
 *
 * Uses AsyncLocalStorage to maintain correlation IDs across async operations.
 * This enables tracing event chains through the entire system.
 *
 * 使用AsyncLocalStorage在异步操作中维护关联ID。
 * 这使得能够追踪整个系统中的事件链。
 */

import { AsyncLocalStorage } from "async_hooks";
import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

/**
 * Correlation context structure
 * 关联上下文结构
 */
export interface CorrelationContext {
  /**
   * Unique correlation ID for this request/event chain
   * 此请求/事件链的唯一关联ID
   */
  correlationId: string;

  /**
   * Causation ID - ID of the event/request that caused this one
   * 因果ID - 导致此操作的事件/请求的ID
   */
  causationId?: string;

  /**
   * Root correlation ID - the original request that started this chain
   * 根关联ID - 启动此链的原始请求
   */
  rootCorrelationId: string;

  /**
   * Event chain depth (how many events deep we are)
   * 事件链深度（我们深入了多少事件）
   */
  depth: number;

  /**
   * Timestamp when correlation started
   * 关联开始时的时间戳
   */
  startTime: number;

  /**
   * User ID if authenticated
   * 已认证的用户ID
   */
  userId?: string;

  /**
   * Request path or event name that started this chain
   * 启动此链的请求路径或事件名称
   */
  origin?: string;

  /**
   * Additional metadata for debugging
   * 用于调试的附加元数据
   */
  metadata?: Record<string, unknown>;
}

/**
 * Global AsyncLocalStorage instance for correlation context
 * 用于关联上下文的全局AsyncLocalStorage实例
 */
const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Injectable service for managing correlation IDs
 * 用于管理关联ID的可注入服务
 */
@Injectable()
export class CorrelationIdProvider {
  private readonly logger = new Logger(CorrelationIdProvider.name);

  /**
   * Get the current correlation context
   * If not in a correlation context, returns undefined
   * 获取当前关联上下文，如果不在关联上下文中则返回undefined
   */
  getContext(): CorrelationContext | undefined {
    return correlationStorage.getStore();
  }

  /**
   * Get the current correlation ID
   * Generates a new one if not in a correlation context
   * 获取当前关联ID，如果不在关联上下文中则生成新ID
   */
  getCorrelationId(): string {
    const context = this.getContext();
    return context?.correlationId || uuidv4();
  }

  /**
   * Get the root correlation ID (for tracing back to original request)
   * 获取根关联ID（用于追溯到原始请求）
   */
  getRootCorrelationId(): string {
    const context = this.getContext();
    return context?.rootCorrelationId || this.getCorrelationId();
  }

  /**
   * Get the causation ID (parent event/request that caused this)
   * 获取因果ID（导致此操作的父事件/请求）
   */
  getCausationId(): string | undefined {
    return this.getContext()?.causationId;
  }

  /**
   * Get current event chain depth
   * 获取当前事件链深度
   */
  getDepth(): number {
    return this.getContext()?.depth || 0;
  }

  /**
   * Check if we're currently in a correlation context
   * 检查当前是否在关联上下文中
   */
  hasContext(): boolean {
    return correlationStorage.getStore() !== undefined;
  }

  /**
   * Run a function within a new correlation context
   * 在新的关联上下文中运行函数
   *
   * @param fn - Function to run
   * @param options - Optional context configuration
   * @returns Result of the function
   */
  runWithCorrelation<T>(
    fn: () => T,
    options?: Partial<CorrelationContext>,
  ): T {
    const existingContext = this.getContext();
    const newCorrelationId = options?.correlationId || uuidv4();

    const depth =
      options?.depth ?? (existingContext ? existingContext.depth + 1 : 0);

    const context: CorrelationContext = {
      correlationId: newCorrelationId,
      causationId: existingContext?.correlationId || options?.causationId,
      rootCorrelationId:
        existingContext?.rootCorrelationId ||
        options?.rootCorrelationId ||
        newCorrelationId,
      depth,
      startTime: options?.startTime || Date.now(),
      userId: options?.userId || existingContext?.userId,
      origin: options?.origin || existingContext?.origin,
      metadata: { ...existingContext?.metadata, ...options?.metadata },
    };

    return correlationStorage.run(context, fn);
  }

  /**
   * Run an async function within a new correlation context
   * 在新的关联上下文中运行异步函数
   *
   * @param fn - Async function to run
   * @param options - Optional context configuration
   * @returns Promise of the function result
   */
  async runWithCorrelationAsync<T>(
    fn: () => Promise<T>,
    options?: Partial<CorrelationContext>,
  ): Promise<T> {
    const existingContext = this.getContext();
    const newCorrelationId = options?.correlationId || uuidv4();

    const depth =
      options?.depth ?? (existingContext ? existingContext.depth + 1 : 0);

    const context: CorrelationContext = {
      correlationId: newCorrelationId,
      causationId: existingContext?.correlationId || options?.causationId,
      rootCorrelationId:
        existingContext?.rootCorrelationId ||
        options?.rootCorrelationId ||
        newCorrelationId,
      depth,
      startTime: options?.startTime || Date.now(),
      userId: options?.userId || existingContext?.userId,
      origin: options?.origin || existingContext?.origin,
      metadata: { ...existingContext?.metadata, ...options?.metadata },
    };

    return correlationStorage.run(context, fn);
  }

  /**
   * Create a child context for event emission
   * Maintains the chain while creating a new correlation ID
   * 为事件发射创建子上下文，维护链的同时创建新的关联ID
   *
   * @param eventName - Name of the event being emitted
   * @returns New correlation context for the event
   */
  createChildContext(eventName: string): CorrelationContext {
    const parentContext = this.getContext();
    const newCorrelationId = uuidv4();

    return {
      correlationId: newCorrelationId,
      causationId: parentContext?.correlationId,
      rootCorrelationId:
        parentContext?.rootCorrelationId || newCorrelationId,
      depth: parentContext ? parentContext.depth + 1 : 0,
      startTime: Date.now(),
      userId: parentContext?.userId,
      origin: eventName,
      metadata: {
        parentEvent: parentContext?.origin,
        ...parentContext?.metadata,
      },
    };
  }

  /**
   * Get context summary for logging
   * 获取用于日志记录的上下文摘要
   */
  getContextSummary(): string {
    const context = this.getContext();
    if (!context) {
      return "no-context";
    }

    return `correlationId=${context.correlationId}, depth=${context.depth}, root=${context.rootCorrelationId}`;
  }

  /**
   * Add metadata to current context
   * 向当前上下文添加元数据
   */
  addMetadata(key: string, value: unknown): void {
    const context = this.getContext();
    if (context?.metadata) {
      context.metadata[key] = value;
    }
  }
}

/**
 * Middleware to initialize correlation context for HTTP requests
 * 用于为HTTP请求初始化关联上下文的中间件
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationIdMiddleware.name);
  private readonly provider = new CorrelationIdProvider();

  /**
   * HTTP header name for correlation ID
   * 关联ID的HTTP头名称
   */
  static readonly CORRELATION_HEADER = "x-correlation-id";
  static readonly CAUSATION_HEADER = "x-causation-id";

  use(req: Request, res: Response, next: NextFunction): void {
    // Extract or generate correlation ID
    const incomingCorrelationId = req.headers[
      CorrelationIdMiddleware.CORRELATION_HEADER
    ] as string | undefined;
    const causationId = req.headers[
      CorrelationIdMiddleware.CAUSATION_HEADER
    ] as string | undefined;

    const correlationId = incomingCorrelationId || uuidv4();

    // Extract user ID from request (if authenticated)
    const userId = (req as any).user?.id || (req as any).userId;

    // Create correlation context
    const context: CorrelationContext = {
      correlationId,
      causationId,
      rootCorrelationId: correlationId,
      depth: 0,
      startTime: Date.now(),
      userId,
      origin: `${req.method} ${req.path}`,
      metadata: {
        userAgent: req.headers["user-agent"],
        ip: req.ip,
      },
    };

    // Set correlation ID in response headers for client tracking
    res.setHeader(CorrelationIdMiddleware.CORRELATION_HEADER, correlationId);

    // Run the rest of the request in correlation context
    correlationStorage.run(context, () => {
      this.logger.debug(
        `Request started: ${req.method} ${req.path} [${correlationId}]`,
      );
      next();
    });
  }
}

/**
 * Export the storage for advanced use cases
 * 导出存储以供高级用例使用
 */
export { correlationStorage };

/**
 * Helper function to get correlation ID without needing to inject the service
 * Useful for static contexts or quick access
 * 无需注入服务即可获取关联ID的辅助函数，适用于静态上下文或快速访问
 */
export function getCurrentCorrelationId(): string {
  const context = correlationStorage.getStore();
  return context?.correlationId || uuidv4();
}

/**
 * Helper function to check if in correlation context
 * 检查是否在关联上下文中的辅助函数
 */
export function hasCorrelationContext(): boolean {
  return correlationStorage.getStore() !== undefined;
}
