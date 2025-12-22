import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
} from '@nestjs/common';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { HttpException } from '@nestjs/common';

/**
 * OpenTelemetry Exception Filter
 * 
 * 全局异常过滤器，只用于在 OpenTelemetry 中记录异常。最后会重新throw Exception，不会影响 NestJS 默认的异常处理行为
 * 根据 OTel 语义规范：
 * - 异常作为 Event 记录在当前 Span 上（使用 span.recordException）
 * - 将 Span 状态标记为 ERROR
 * 
 * 这样在 Trace 页面中，异常的 Span 会直接标红显示。
 * 
 * @example
 * ```typescript
 * // 在 main.ts 中注册：
 * app.useGlobalFilters(new OtelExceptionFilter());
 * ```
 */
@Catch()
export class OtelExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const span = trace.getActiveSpan();

    if (!span) throw exception;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();

      // 只把 5xx 当成 ERROR
      if (status >= 500) {
        span.recordException(exception);
        span.setStatus({ code: SpanStatusCode.ERROR });
      } else {
        // 4xx：可选，打点但不标错
        span.setAttribute('http.status_code', status);
      }
    } else {
      // 非 HttpException：系统异常
      span.recordException(exception as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
    }

    throw exception;
  }
}