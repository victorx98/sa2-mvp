import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { trace } from '@opentelemetry/api';

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return '[unserializable]';
  }
};

/**
 * Interceptor that enriches OpenTelemetry spans with HTTP request context
 *
 * Automatically adds:
 * - User ID and role (if authenticated)
 * - Request ID
 * - Client IP
 * - User agent
 *
 * Usage:
 * ```typescript
 * @UseInterceptors(TracingInterceptor)
 * @Controller('bookings')
 * export class BookingController { }
 *
 * // Or apply globally in main.ts:
 * app.useGlobalInterceptors(new TracingInterceptor());
 * ```
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();
    const span = trace.getActiveSpan();

    if (span) {
      const { traceId, spanId } = span.spanContext();
      console.log('TracingInterceptor traceId:', traceId, 'spanId:', spanId);
    }

    console.log('tracing.interceptor, span=', span);
    if (span && request) {
      console.log('request.user: ', request.user);
      // Add user context if authenticated
      if (request.user) {
        span.setAttribute('user.id', request.user.id || 'unknown');
        span.setAttribute('user.role', request.user.role || 'unknown');

        // Add user email if available (useful for debugging)
        if (request.user.email) {
          span.setAttribute('user.email', request.user.email);
        }
      }

      // Add request metadata
      if (request.id) {
        span.setAttribute('request.id', request.id);
      }

      // Add client information
      const clientIp =
        request.headers['x-forwarded-for'] ||
        request.headers['x-real-ip'] ||
        request.connection?.remoteAddress ||
        request.socket?.remoteAddress;

      if (clientIp) {
        span.setAttribute('client.ip', String(clientIp).split(',')[0].trim());
      }

      if (request.headers['user-agent']) {
        span.setAttribute('client.user_agent', request.headers['user-agent']);
      }

      // Add route information
      const controller = context.getClass().name;
      const handler = context.getHandler().name;
      span.setAttribute('controller.name', controller);
      span.setAttribute('controller.handler', handler);

      // Add request payload details
      if (request.query) {
        span.setAttribute('request.query', safeStringify(request.query));
      }

      if (request.body) {
        span.setAttribute('request.body', safeStringify(request.body));
      }

      // Add correlation ID if present (for distributed tracing)
      if (request.headers['x-correlation-id']) {
        span.setAttribute(
          'correlation.id',
          request.headers['x-correlation-id'],
        );
      }
    }

    return next.handle().pipe(
      tap({
        next: (data) => {
          // Optionally add response metadata
          if (span) {
            // Record if response has data
            span.setAttribute('response.has_data', data !== null && data !== undefined);
            if (response?.statusCode) {
              span.setAttribute('response.status_code', response.statusCode);
            }
          }
        },
        error: (error) => {
          // Error will be recorded by the @Trace decorator or auto-instrumentation
          // But we can add HTTP-specific context here
          if (span && error) {
            span.setAttribute('error.source', 'http_response');
            if (response?.statusCode) {
              span.setAttribute('response.status_code', response.statusCode);
            }
          }
        },
      }),
    );
  }
}
