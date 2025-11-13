import { ConsoleLogger, ConsoleLoggerOptions, Injectable, LogLevel } from "@nestjs/common";
import { SpanContext, SpanStatusCode, trace } from "@opentelemetry/api";
import { formatWithOptions } from "util";

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
  private readonly tracer = trace.getTracer("logger");

  constructor();
  constructor(context: string);
  constructor(options: ConsoleLoggerOptions);
  constructor(context: string, options: ConsoleLoggerOptions);
  constructor(contextOrOptions?: string | ConsoleLoggerOptions, options?: ConsoleLoggerOptions) {
    const context = typeof contextOrOptions === "string" ? contextOrOptions : undefined;
    const resolvedOptions =
      typeof contextOrOptions === "string" ? options : (contextOrOptions as ConsoleLoggerOptions | undefined);
    super(context, resolvedOptions);
  }

  override log(message: any, ...optionalParams: [...any, string?]): void {
    this.logWithSpan("log", message, optionalParams, (msg, params) => super.log(msg, ...(params as [...any, string?])));
  }

  override error(message: any, ...optionalParams: [...any, string?, string?]): void {
    this.logWithSpan("error", message, optionalParams, (msg, params) =>
      super.error(msg, ...(params as [...any, string?, string?])),
    );
  }

  override warn(message: any, ...optionalParams: [...any, string?]): void {
    this.logWithSpan("warn", message, optionalParams, (msg, params) => super.warn(msg, ...(params as [...any, string?])));
  }

  override debug(message: any, ...optionalParams: [...any, string?]): void {
    super.debug(this.injectTraceContext(message), ...optionalParams);
  }

  override verbose(message: any, ...optionalParams: [...any, string?]): void {
    super.verbose(this.injectTraceContext(message), ...optionalParams);
  }

  override fatal(message: any, ...optionalParams: [...any, string?]): void {
    this.logWithSpan("fatal", message, optionalParams, (msg, params) =>
      super.fatal(msg, ...(params as [...any, string?])),
    );
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

  // Wrap high-signal log levels in dedicated spans so they surface in trace backends.
  private logWithSpan(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
    invokeSuper: (message: unknown, optionalParams: unknown[]) => void,
  ): void {
    const { formattedMessage, superParams } = this.prepareConsoleArguments(level, message, optionalParams);

    this.tracer.startActiveSpan(this.buildSpanName(level), (span) => {
      try {
        span.setAttribute("logger.level", level);
        if (this.context) {
          span.setAttribute("logger.context", this.context);
        }

        const messageForSpan = this.formatForSpan(message);
        if (messageForSpan !== undefined) {
          span.setAttribute("logger.message", messageForSpan);
        }

        if (optionalParams.length > 0) {
          span.setAttribute("logger.optional_param_count", optionalParams.length);
        }

        const inputError = this.extractError(message, optionalParams);
        if (inputError) {
          span.recordException(inputError);
          span.setStatus({ code: SpanStatusCode.ERROR, message: inputError.message });
        } else if (level === "error" || level === "fatal") {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: typeof message === "string" ? message : undefined,
          });
        }

        const messageWithTrace = this.injectTraceContext(formattedMessage);
        invokeSuper(messageWithTrace, superParams);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        span.recordException(err);
        span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
        throw error;
      } finally {
        span.end();
      }
    });
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

  private buildSpanName(level: LogLevel): string {
    const contextLabel = this.context ?? "Logger";
    return `${contextLabel}.${level}`;
  }

  private formatForSpan(message: unknown): string | undefined {
    if (message == null) {
      return undefined;
    }

    if (typeof message === "string") {
      return message;
    }

    if (message instanceof Error) {
      return message.message;
    }

    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }

  private extractError(message: unknown, optionalParams: unknown[]): Error | undefined {
    if (message instanceof Error) {
      return message;
    }

    const errorParam = optionalParams.find((param): param is Error => param instanceof Error);
    if (errorParam) {
      return errorParam;
    }

    return undefined;
  }

  private prepareConsoleArguments(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): { formattedMessage: unknown; superParams: unknown[] } {
    const params = [...optionalParams];
    const superParams: unknown[] = [];

    let contextParam: string | undefined;
    if (params.length > 0 && typeof params[params.length - 1] === "string") {
      contextParam = params.pop() as string;
    }

    let stackParam: string | undefined;
    if ((level === "error" || level === "fatal") && params.length > 0 && typeof params[params.length - 1] === "string") {
      stackParam = params.pop() as string;
    }

    const formattedMessage =
      params.length > 0 ? formatWithOptions({ colors: false }, message as any, ...params) : message;

    if (stackParam !== undefined) {
      superParams.push(stackParam);
    }

    if (contextParam !== undefined) {
      superParams.push(contextParam);
    }

    return { formattedMessage, superParams };
  }
}
