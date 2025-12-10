import { Logger, ValidationPipe, BadRequestException } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as dotenv from "dotenv";

import { AppModule } from "./app.module";
import { OtelLoggerService } from "./shared/logging/otel-logger.service";
import {
  ensureTelemetryStarted,
  shutdownTelemetry,
} from "./telemetry/opentelemetry";
import { ResponseInterceptor } from "./shared/interceptors/response.interceptor";
import { ErrorInterceptor } from "./shared/interceptors/error.interceptor";

dotenv.config();

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
      logger.warn(
        `Received ${signal}. Initiating graceful shutdown.`,
        "Bootstrap",
      );
      try {
        await app.close();
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? (error.stack ?? error.message)
            : String(error);
        logger.error(
          `Error during Nest application shutdown: ${errorMessage}`,
          error instanceof Error ? error.stack : undefined,
          "Bootstrap",
        );
      } finally {
        process.exit(0);
      }
    };

    shutdown().catch((error) => {
      const errorMessage =
        error instanceof Error ? (error.stack ?? error.message) : String(error);
      logger.error(
        `Unhandled error during shutdown: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
        "Bootstrap",
      );
      process.exit(1);
    });
  };

  process.once("SIGINT", signalHandler);
  process.once("SIGTERM", signalHandler);

  // Enable validation with detailed error logging [启用验证并记录详细错误日志]
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        // Format validation errors for detailed logging [格式化验证错误以便详细记录]
        const messages = errors.map((err) => {
          const constraints = err.constraints
            ? Object.values(err.constraints)
            : [];
          return {
            property: err.property,
            constraints,
            value: err.value,
            children: err.children?.length || 0,
          };
        });

        // Log detailed validation errors [记录详细的验证错误]
        logger.error(
          `Validation failed: ${JSON.stringify(messages, null, 2)}`,
          "ValidationPipe",
        );

        // Return formatted error response [返回格式化的错误响应]
        return new BadRequestException({
          statusCode: 400,
          message: "Validation failed",
          errors: messages.map((msg) => ({
            field: msg.property,
            messages: msg.constraints,
            value: msg.value,
          })),
        });
      },
    }),
  );

  // Enable global interceptors
  app.useGlobalInterceptors(new ResponseInterceptor(), new ErrorInterceptor());

  // Enable CORS
  app.enableCors();

  // Configure Swagger documentation
  const config = new DocumentBuilder()
    .setTitle("MentorX API")
    .setDescription("API documentation for MentorX platform")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 8080;
  await app.listen(port);
  logger.log(
    `Application is running on: http://localhost:${port}`,
    "Bootstrap",
  );
  logger.log(
    `Swagger documentation is available at: http://localhost:${port}/api/docs`,
    "Bootstrap",
  );
}

bootstrap().catch((err) => {
  console.error("Application failed to start:", err);
  process.exit(1);
});
