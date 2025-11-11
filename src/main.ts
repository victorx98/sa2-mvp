import "./telemetry/opentelemetry";

import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module";
import { OtelLoggerService } from "./shared/logging/otel-logger.service";
import { ensureTelemetryStarted, shutdownTelemetry } from "./telemetry/opentelemetry";

async function bootstrap() {
  await ensureTelemetryStarted();

  const logger = new OtelLoggerService();
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger,
  });

  app.useLogger(logger);
  Logger.overrideLogger(logger);

  const originalClose = app.close.bind(app);
  app.close = async () => {
    await originalClose();
    await shutdownTelemetry();
  };

  const signalHandler = (signal: NodeJS.Signals) => {
    const shutdown = async () => {
      logger.warn(`Received ${signal}. Initiating graceful shutdown.`, "Bootstrap");
      try {
        await app.close();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.stack ?? error.message : String(error);
        logger.error(`Error during Nest application shutdown: ${errorMessage}`, error instanceof Error ? error.stack : undefined, "Bootstrap");
      } finally {
        process.exit(0);
      }
    };

    shutdown().catch((error) => {
      const errorMessage = error instanceof Error ? error.stack ?? error.message : String(error);
      logger.error(`Unhandled error during shutdown: ${errorMessage}`, error instanceof Error ? error.stack : undefined, "Bootstrap");
      process.exit(1);
    });
  };

  process.once("SIGINT", signalHandler);
  process.once("SIGTERM", signalHandler);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  const port = process.env.PORT || 8080;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`, "Bootstrap");
}

bootstrap().catch((err) => {
  console.error("Application failed to start:", err);
  process.exit(1);
});
