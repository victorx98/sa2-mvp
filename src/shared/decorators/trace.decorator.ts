import { trace, Span, SpanStatusCode, context } from '@opentelemetry/api';

/**
 * Options for the @Trace decorator
 */
export interface TraceOptions {
  /**
   * Custom span name. If not provided, uses className.methodName
   */
  name?: string;

  /**
   * Additional attributes to add to the span
   */
  attributes?: Record<string, string | number | boolean>;

  /**
   * Whether to record method arguments as span attributes
   * Default: false (for security/privacy)
   */
  recordArguments?: boolean;

  /**
   * Whether to record the return value as a span attribute
   * Default: false (for security/privacy)
   */
  recordReturnValue?: boolean;
}

/**
 * Method decorator that automatically creates an OpenTelemetry span for the decorated method
 *
 * @example
 * ```typescript
 * @Trace()
 * async createBooking(dto: CreateBookingDto) {
 *   // Method logic
 * }
 *
 * @Trace({ name: 'custom-span-name', attributes: { 'user.type': 'student' } })
 * async processPayment(amount: number) {
 *   // Method logic
 * }
 * ```
 */
export function Trace(options: TraceOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    const className = target.constructor.name;

    descriptor.value = async function (...args: any[]) {
      // Build span name
      const spanName = options.name || `${className}.${propertyKey}`;

      // Get tracer
      const tracer = trace.getTracer('mentorx-backend');

      // Start span
      return await tracer.startActiveSpan(spanName, async (span: Span) => {
        try {
          // Add custom attributes
          if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
              span.setAttribute(key, value);
            });
          }

          // Add class and method info
          span.setAttribute('code.function', propertyKey);
          span.setAttribute('code.namespace', className);

          // Record arguments if enabled (sanitized)
          if (options.recordArguments && args.length > 0) {
            span.setAttribute('args.count', args.length);
            // Only record primitive types for safety
            args.forEach((arg, index) => {
              if (
                typeof arg === 'string' ||
                typeof arg === 'number' ||
                typeof arg === 'boolean'
              ) {
                span.setAttribute(`args.${index}`, arg);
              }
            });
          }

          // Execute original method
          const startTime = Date.now();
          const result = await originalMethod.apply(this, args);
          const duration = Date.now() - startTime;

          // Record execution time
          span.setAttribute('execution.duration_ms', duration);

          // Record return value if enabled and is primitive
          if (options.recordReturnValue && result !== undefined) {
            if (
              typeof result === 'string' ||
              typeof result === 'number' ||
              typeof result === 'boolean'
            ) {
              span.setAttribute('return.value', result);
            } else if (result && typeof result === 'object') {
              // Record object type only
              span.setAttribute('return.type', result.constructor.name);
            }
          }

          // Mark as successful
          span.setStatus({ code: SpanStatusCode.OK });

          return result;
        } catch (error) {
          // Record error details
          if (error instanceof Error) {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            span.setAttribute('error.type', error.constructor.name);
          } else {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: String(error),
            });
          }

          // Re-throw the error
          throw error;
        } finally {
          // Always end the span
          span.end();
        }
      });
    };

    return descriptor;
  };
}

/**
 * Helper function to add attributes to the current active span
 * Useful for adding dynamic attributes during method execution
 *
 * @example
 * ```typescript
 * addSpanAttributes({ 'user.id': userId, 'booking.id': bookingId });
 * ```
 */
export function addSpanAttributes(
  attributes: Record<string, string | number | boolean>,
): void {
  const span = trace.getActiveSpan();
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
}

/**
 * Helper function to add an event to the current active span
 *
 * @example
 * ```typescript
 * addSpanEvent('payment.validated', { amount: 100, currency: 'USD' });
 * ```
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>,
): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}
