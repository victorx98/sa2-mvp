import { diag, DiagConsoleLogger, DiagLogLevel, trace } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVER_ADDRESS, ATTR_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from "@opentelemetry/semantic-conventions";

const isTelemetryEnabled =
  process.env.OTEL_ENABLED !== "false" && process.env.NODE_ENV !== "test";

if (process.env.OTEL_LOG_LEVEL) {
  const logLevel = process.env.OTEL_LOG_LEVEL.toUpperCase();
  const level =
    DiagLogLevel[logLevel as keyof typeof DiagLogLevel] ?? DiagLogLevel.INFO;
  diag.setLogger(new DiagConsoleLogger(), level);
}

let sdkStarted = false;
let sdk: NodeSDK | null = null;
let sdkStarting = false;

const serviceName = process.env.SERVICE_NAME;

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
  const traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    headers: {
      Authorization: `Basic ${process.env.OTEL_EXPORTER_OTLP_AUTH_TOKEN}`,
    },
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT ??
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      headers: {
        Authorization: `Basic ${process.env.OTEL_EXPORTER_OTLP_AUTH_TOKEN}`,
      },
    }),
  });

  const logRecordProcessor = new BatchLogRecordProcessor(
    new OTLPLogExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      headers: {
        Authorization: `Basic ${process.env.OTEL_EXPORTER_OTLP_AUTH_TOKEN}`,
      },
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
    return;
  }

  if (sdkStarted || sdkStarting) {
    return;
  }

  if (!sdk) {
    sdk = buildSdk();
  }

  sdkStarting = true;
  try {
    sdk.start();
    console.log('OTEL SDK started');
    sdkStarted = true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to start OpenTelemetry SDK", error);
    sdk = null;
    throw error;
  } finally {
    sdkStarting = false;
  }
  const tracer = trace.getTracer('test');
  const span = tracer.startSpan('test-span');
  span.end();
  console.log('Trace sent!');
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error shutting down OpenTelemetry SDK", error);
  } finally {
    sdkStarted = false;
    sdk = null;
  }
}

ensureTelemetryStarted().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled error starting OpenTelemetry SDK", error);
});
