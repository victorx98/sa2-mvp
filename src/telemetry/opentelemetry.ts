import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from "@opentelemetry/semantic-conventions";

const isTelemetryEnabled = process.env.OTEL_ENABLED !== "false";

if (process.env.OTEL_LOG_LEVEL) {
  const logLevel = process.env.OTEL_LOG_LEVEL.toUpperCase();
  const level =
    DiagLogLevel[logLevel as keyof typeof DiagLogLevel] ?? DiagLogLevel.INFO;
  diag.setLogger(new DiagConsoleLogger(), level);
}

let sdkStarted = false;
let sdk: NodeSDK | null = null;
let sdkStarting = false;
let startupError: Error | null = null;

/**
 * 从 OTEL_RESOURCE_ATTRIBUTES 解析服务名
 * 格式: "service.name=mentorxsa2,key2=value2"
 */
export function parseServiceNameFromResourceAttributes(): string | undefined {
  const resourceAttrs = process.env.OTEL_RESOURCE_ATTRIBUTES;
  if (resourceAttrs) {
    const pairs = resourceAttrs.split(',');
    for (const pair of pairs) {
      const [key, value] = pair.split('=').map(s => s.trim());
      if (key === 'service.name' && value) {
        return value;
      }
    }
  }
  return undefined;
}

/**
 * 获取服务名称，与 Resource 中的 service.name 保持一致
 * 用于 tracer 和 logger 的命名，确保可观测性数据的一致性
 */
export function getServiceName(): string {
  return (
    parseServiceNameFromResourceAttributes() ??
    process.env.SERVICE_NAME ??
    process.env.OTEL_SERVICE_NAME
  );
}

const serviceName = getServiceName();

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]:
    process.env.OTEL_SERVICE_VERSION ??
    process.env.SERVICE_VERSION ??
    process.env.npm_package_version ??
    "0.0.1",
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
    process.env.NODE_ENV ??
    "development",
});

/**
 * 解析认证头
 * 支持两种格式：
 * 1. OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic ..." (完整格式)
 * 2. OTEL_EXPORTER_OTLP_AUTH_TOKEN="..." (仅token，需要添加 Basic 前缀)
 * 3. OTEL_EXPORTER_OTLP_HEADERS_AUTH="..." (备用token)
 */
function parseAuthHeaders(): Record<string, string> | undefined {
  // 优先使用 OTEL_EXPORTER_OTLP_HEADERS (完整格式)
  if (process.env.OTEL_EXPORTER_OTLP_HEADERS) {
    const headers: Record<string, string> = {};
    const pairs = process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',');
    for (const pair of pairs) {
      // 只分割第一个 '='，因为值中可能包含 '=' (如 base64 token 的填充 '==')
      // 企业版本的 token 通常以 '==' 结尾，个人版本可能没有
      const equalIndex = pair.indexOf('=');
      if (equalIndex > 0) {
        const key = pair.substring(0, equalIndex).trim();
        const value = pair.substring(equalIndex + 1).trim();
        if (key && value) {
          headers[key] = value;
        }
      }
    }
    if (Object.keys(headers).length > 0) {
      // 调试：检查 Authorization header 是否完整（特别是检查末尾的 ==）
      if (headers.Authorization) {
        const authValue = headers.Authorization;
        // 隐藏敏感信息，只显示格式
        const sanitized = authValue.substring(0, 20) + '...' + authValue.substring(authValue.length - 5);
        console.log('[OpenTelemetry] Authorization (sanitized):', sanitized);
      }
      return headers;
    }
  }

  // 回退到 OTEL_EXPORTER_OTLP_AUTH_TOKEN
  if (process.env.OTEL_EXPORTER_OTLP_AUTH_TOKEN) {
    return { Authorization: `Basic ${process.env.OTEL_EXPORTER_OTLP_AUTH_TOKEN}` };
  }

  // 最后尝试 OTEL_EXPORTER_OTLP_HEADERS_AUTH
  if (process.env.OTEL_EXPORTER_OTLP_HEADERS_AUTH) {
    return { Authorization: `Basic ${process.env.OTEL_EXPORTER_OTLP_HEADERS_AUTH}` };
  }

  return undefined;
}

function buildSdk(): NodeSDK {
  const authHeaders = parseAuthHeaders();
  const traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    ...(authHeaders ? { headers: authHeaders } : {}),
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      ...(authHeaders ? { headers: authHeaders } : {}),
    }),
  });

  const logRecordProcessor = new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      ...(authHeaders ? { headers: authHeaders } : {}),
    }),
  );

  const instrumentations = getNodeAutoInstrumentations({
    "@opentelemetry/instrumentation-http": {
      enabled: true,
      requireParentforOutgoingSpans: false,
    },
    // 自动为controller的方法创建span
    "@opentelemetry/instrumentation-nestjs-core": {
      enabled: true,
    },
    "@opentelemetry/instrumentation-express": {
      enabled: true,
    },
    // 禁用 pg instrumentation，因为使用 @kubiks/otel-drizzle 在 Drizzle ORM 层面追踪
    // otelDrizzle 提供更详细的追踪信息（SQL 语句、表名、操作类型等）
    "@opentelemetry/instrumentation-pg": {
      enabled: false,
    },
  });

  return new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    logRecordProcessor,
    instrumentations,
  });
}

export async function ensureTelemetryStarted(): Promise<void> {
  if (!isTelemetryEnabled) {
    console.log('OpenTelemetry is disabled (OTEL_ENABLED=false)');
    return;
  }

  if (sdkStarted) {
    return;
  }

  if (sdkStarting) {
    console.warn('OpenTelemetry SDK is already starting...');
    return;
  }

  if (!sdk) {
    try {
      sdk = buildSdk();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to build OpenTelemetry SDK:', errorMessage);
      startupError = error instanceof Error ? error : new Error(errorMessage);
      return;
    }
  }

  sdkStarting = true;
  try {
    sdk.start();
    console.log(`OpenTelemetry SDK started successfully for service: ${serviceName}`);
    sdkStarted = true;
    startupError = null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to start OpenTelemetry SDK:', errorMessage);
    console.error('Application will continue without telemetry. Check your OTEL_EXPORTER_OTLP_ENDPOINT configuration.');

    startupError = error instanceof Error ? error : new Error(errorMessage);
    sdk = null;

    // Don't throw - allow application to start without telemetry
  } finally {
    sdkStarting = false;
  }
}

export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) {
    return;
  }

  if (!sdkStarted) {
    return;
  }

  try {
    await sdk.shutdown();
    console.log('OpenTelemetry SDK shut down successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error shutting down OpenTelemetry SDK:', errorMessage);
  } finally {
    sdkStarted = false;
    sdk = null;
  }
}

/**
 * Get the current status of OpenTelemetry SDK
 * Useful for health checks and monitoring
 */
export function getTelemetryStatus(): {
  enabled: boolean;
  started: boolean;
  starting: boolean;
  error: Error | null;
  serviceName: string | undefined;
} {
  return {
    enabled: isTelemetryEnabled,
    started: sdkStarted,
    starting: sdkStarting,
    error: startupError,
    serviceName,
  };
}

void (async () => {
  await ensureTelemetryStarted();
})();
