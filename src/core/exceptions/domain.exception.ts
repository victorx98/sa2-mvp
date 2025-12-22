/**
 * DomainException (领域异常)
 * Base class for all domain-specific exceptions (所有领域特定异常的基类)
 *
 * Domain exceptions represent business rule violations and should be caught
 * and converted to appropriate HTTP responses in the application layer.
 * (领域异常代表业务规则违反，应该在应用层捕获并转换为适当的HTTP响应)
 */
export class DomainException extends Error {
  /**
   * Create a DomainException (创建DomainException)
   *
   * @param code - Unique error code (take from exception key: INVALID_PRODUCT_CODE, INSUFFICIENT_BALANCE, etc.) (唯一错误码)
   * @param message - Human-readable error message (可读的错误消息)
   * @param metadata - Additional context information (metadata, used for logging and debugging) (额外的上下文信息)
   */
  constructor(
    public readonly code: string,
    message: string,
    public readonly metadata?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintains proper stack trace for where our error was thrown (only available on V8) (维护错误抛出位置的堆栈跟踪)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to object representation (转换为对象表示)
   *
   * @returns Object with error details (包含错误详情的对象)
   */
  toObject(): {
    code: string;
    message: string;
    metadata?: Record<string, any>;
    stack?: string;
  } {
    return {
      code: this.code,
      message: this.message,
      metadata: this.metadata,
      stack: this.stack,
    };
  }
}
