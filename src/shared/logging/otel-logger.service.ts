import { ConsoleLogger, ConsoleLoggerOptions, Injectable, LogLevel } from "@nestjs/common";
import { SpanContext, trace } from "@opentelemetry/api";

type JsonLogObject = ReturnType<ConsoleLogger["getJsonLogObject"]>;

function getActiveSpanContext(): SpanContext | null {
  const span = trace.getActiveSpan();
  if (!span) {
    return null;
  }

  const spanContext = span.spanContext();
  if (!spanContext || !spanContext.traceId || spanContext.traceId === "00000000000000000000000000000000") {
    return null;
  }

  return spanContext;
}

@Injectable()
export class OtelLoggerService extends ConsoleLogger {
  constructor();
  constructor(context: string);
  constructor(options: ConsoleLoggerOptions);
  constructor(context: string, options: ConsoleLoggerOptions);
  constructor(contextOrOptions?: string | ConsoleLoggerOptions, options?: ConsoleLoggerOptions) {
    if (typeof contextOrOptions === "string") {
      super(contextOrOptions, options);
      return;
    }

    if (contextOrOptions) {
      super(contextOrOptions);
      return;
    }

    super();
  }

  override log(message: any, ...optionalParams: [...any, string?]): void {
    console.log("[OtelLoggerService]log: ", message);
    super.log(this.injectTraceContext(message), ...optionalParams);
  }

  override error(message: any, ...optionalParams: [...any, string?, string?]): void {
    super.error(this.injectTraceContext(message), ...optionalParams);
  }

  override warn(message: any, ...optionalParams: [...any, string?]): void {
    super.warn(this.injectTraceContext(message), ...optionalParams);
  }

  override debug(message: any, ...optionalParams: [...any, string?]): void {
    super.debug(this.injectTraceContext(message), ...optionalParams);
  }

  override verbose(message: any, ...optionalParams: [...any, string?]): void {
    super.verbose(this.injectTraceContext(message), ...optionalParams);
  }

  override fatal(message: any, ...optionalParams: [...any, string?]): void {
    super.fatal(this.injectTraceContext(message), ...optionalParams);
  }

  protected override getJsonLogObject(
    message: unknown,
    options: {
      context: string;
      logLevel: LogLevel;
      writeStreamType?: "stdout" | "stderr" | undefined;
      errorStack?: unknown;
    },
  ): JsonLogObject & Record<string, unknown> {
    const spanContext = getActiveSpanContext();
    const base = super.getJsonLogObject(message, options) as JsonLogObject & Record<string, unknown>;

    if (spanContext) {
      base.traceId ??= spanContext.traceId;
      base.spanId ??= spanContext.spanId;
    }

    return base;
  }

  private injectTraceContext(message: unknown): unknown {
    const spanContext = getActiveSpanContext();
    if (!spanContext) {
      return message;
    }

    if (typeof message === "string") {
      return `${message} [traceId=${spanContext.traceId} spanId=${spanContext.spanId}]`;
    }

    if (typeof message === "object" && message !== null) {
      return {
        ...message,
        traceId: (message as Record<string, unknown>).traceId ?? spanContext.traceId,
        spanId: (message as Record<string, unknown>).spanId ?? spanContext.spanId,
      };
    }

    return `${String(message)} [traceId=${spanContext.traceId} spanId=${spanContext.spanId}]`;
  }
}
