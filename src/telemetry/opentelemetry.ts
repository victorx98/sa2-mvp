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

const serviceName =
  process.env.SERVICE_NAME ??
  process.env.npm_package_name ??
  "sa2-mvp";

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

function buildSdk(): NodeSDK {
  const authHeaders = process.env.OTEL_EXPORTER_OTLP_AUTH_TOKEN
    ? { Authorization: `Basic ${process.env.OTEL_EXPORTER_OTLP_AUTH_TOKEN}` }
    : undefined;

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
    "@opentelemetry/instrumentation-nestjs-core": {
      enabled: true,
    },
    "@opentelemetry/instrumentation-express": {
      enabled: true,
    },
    "@opentelemetry/instrumentation-pg": {
      enabled: true,
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
    await sdk.start();
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
