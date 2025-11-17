import { ConsoleLogger, ConsoleLoggerOptions, Injectable, LogLevel } from "@nestjs/common";
import { context, SpanContext, trace } from "@opentelemetry/api";
import { logs, Logger as OtelLogEmitter, SeverityNumber, LogAttributes } from "@opentelemetry/api-logs";
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
  private readonly otelLogger: OtelLogEmitter;

  constructor();
  constructor(context: string);
  constructor(options: ConsoleLoggerOptions);
  constructor(context: string, options: ConsoleLoggerOptions);
  constructor(contextOrOptions?: string | ConsoleLoggerOptions, options?: ConsoleLoggerOptions) {
    const contextLabel = typeof contextOrOptions === "string" ? contextOrOptions : undefined;
    const resolvedOptions =
      typeof contextOrOptions === "string" ? options : (contextOrOptions as ConsoleLoggerOptions | undefined);
    super(contextLabel, resolvedOptions);
    this.otelLogger = logs.getLogger("sa2-mvp-logger");
  }

  override log(message: any, ...optionalParams: [...any, string?]): void {
    this.logInternal("log", message, optionalParams, (msg, params) =>
      super.log(msg, ...(params as [...any, string?])),
    );
  }

  override error(message: any, ...optionalParams: [...any, string?, string?]): void {
    this.logInternal("error", message, optionalParams, (msg, params) =>
      super.error(msg, ...(params as [...any, string?, string?])),
    );
  }

  override warn(message: any, ...optionalParams: [...any, string?]): void {
    this.logInternal("warn", message, optionalParams, (msg, params) =>
      super.warn(msg, ...(params as [...any, string?])),
    );
  }

  override debug(message: any, ...optionalParams: [...any, string?]): void {
    this.logInternal("debug", message, optionalParams, (msg, params) =>
      super.debug(msg, ...(params as [...any, string?])),
    );
  }

  override verbose(message: any, ...optionalParams: [...any, string?]): void {
    this.logInternal("verbose", message, optionalParams, (msg, params) =>
      super.verbose(msg, ...(params as [...any, string?])),
    );
  }

  override fatal(message: any, ...optionalParams: [...any, string?]): void {
    this.logInternal("fatal", message, optionalParams, (msg, params) =>
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

  private logInternal(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
    invokeSuper: (message: unknown, optionalParams: unknown[]) => void,
  ): void {
    const { formattedMessage, superParams } = this.prepareConsoleArguments(level, message, optionalParams);
    this.emitOtelLog(level, formattedMessage, message, optionalParams);

    const messageWithTrace = this.injectTraceContext(formattedMessage);
    invokeSuper(messageWithTrace, superParams);
  }

  private emitOtelLog(
    level: LogLevel,
    formattedMessage: unknown,
    originalMessage: unknown,
    optionalParams: unknown[],
  ): void {
    const severityNumber = this.mapSeverity(level);
    const spanContext = getActiveSpanContext();
    const attributes: LogAttributes = {};

    if (this.context) {
      attributes["logger.context"] = this.context;
    }

    if (optionalParams.length > 0) {
      attributes["logger.optional_param_count"] = optionalParams.length;
    }

    if (spanContext) {
      attributes["traceId"] = spanContext.traceId;
      attributes["spanId"] = spanContext.spanId;
    }

    const inputError = this.extractError(originalMessage, optionalParams);
    if (inputError) {
      attributes["exception.type"] = inputError.name;
      attributes["exception.message"] = inputError.message;
      if (inputError.stack) {
        attributes["exception.stacktrace"] = inputError.stack;
      }
    }

    const messageForBody = formattedMessage ?? originalMessage;
    const body = this.formatForSpan(messageForBody);
    try {
      this.otelLogger.emit({
        severityNumber,
        severityText: level.toUpperCase(),
        body: body ?? (messageForBody === undefined ? "undefined" : String(messageForBody)),
        attributes,
        timestamp: Date.now(),
        context: spanContext ? trace.setSpan(context.active(), trace.wrapSpanContext(spanContext)) : context.active(),
      });
    } catch (error) {
      // Swallow emitter failures to avoid infinite recursion in logging.
      // Use console.debug directly to avoid triggering this logger again.
      if (process.env.OTEL_LOG_LEVEL === "DEBUG") {
        console.debug("[OtelLogger] Failed to emit log to OTLP:", error instanceof Error ? error.message : error);
      }
    }
  }

  private mapSeverity(level: LogLevel): SeverityNumber {
    switch (level) {
      case "fatal":
        return SeverityNumber.FATAL;
      case "error":
        return SeverityNumber.ERROR;
      case "warn":
        return SeverityNumber.WARN;
      case "debug":
        return SeverityNumber.DEBUG;
      case "verbose":
        return SeverityNumber.TRACE;
      case "log":
      default:
        return SeverityNumber.INFO;
    }
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
