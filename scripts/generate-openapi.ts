import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { config as loadEnv } from "dotenv";
import { Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { AppModule } from "../src/app.module";
import { ApiModule } from "../src/api/api.module";
import { DATABASE_CONNECTION } from "../src/infrastructure/database/database.provider";
import { SupabaseAuthService } from "../src/infrastructure/auth/supabase-auth.service";
import { EventPublisherTask } from "../src/domains/contract/tasks/event-publisher.task";
import { ServiceHoldExpiryTask } from "../src/domains/contract/tasks/hold-cleanup.task";
import { NotificationQueueService } from "../src/core/notification/queue/notification-queue.service";
import type * as schema from "../src/infrastructure/database/schema";

/**
 * Load environment variables so ConfigModule works as expected.
 * Missing .env is acceptable; defaults inside ConfigModule will apply.
 */
loadEnv({ path: ".env", override: false });

async function generateOpenApiDocument(): Promise<void> {
  const logger = new Logger("OpenAPIGenerator");

  // Use Nest testing utilities so we can override infrastructure providers.
  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(DATABASE_CONNECTION)
    .useValue(createDatabaseStub())
    .overrideProvider(SupabaseAuthService)
    .useValue(createSupabaseAuthStub())
    .overrideProvider(EventPublisherTask)
    .useValue(createCronStub())
    .overrideProvider(ServiceHoldExpiryTask)
    .useValue(createCronStub())
    .overrideProvider(NotificationQueueService)
    .useValue(createNotificationQueueStub())
    .compile();

  const app = testingModule.createNestApplication();
  await app.init();

  const config = new DocumentBuilder()
    .setTitle("MentorX API")
    .setDescription("MentorX backend OpenAPI specification")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [ApiModule],
    deepScanRoutes: true,
  });

  const outputPath = join(process.cwd(), "docs", "openapi.json");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2), "utf8");
  logger.log(`OpenAPI spec generated at ${outputPath}`);

  await app.close();
}

/**
 * Provide a proxy database that throws if accidentally used while generating docs.
 */
function createDatabaseStub(): NodePgDatabase<typeof schema> {
  const handler = new Proxy(
    {},
    {
      get: (_target, propertyKey) => {
        if (
          propertyKey === "then" ||
          propertyKey === Symbol.toStringTag ||
          propertyKey === "onModuleInit" ||
          propertyKey === "onModuleDestroy" ||
          propertyKey === "beforeApplicationShutdown" ||
          propertyKey === "onApplicationBootstrap" ||
          propertyKey === "onApplicationShutdown"
        ) {
          return undefined;
        }

        return () => {
          throw new Error(
            `Database access is disabled during OpenAPI generation (attempted to use "${String(propertyKey)}").`,
          );
        };
      },
    },
  );

  return handler as NodePgDatabase<typeof schema>;
}

/**
 * Provide a SupabaseAuthService stub to avoid requiring real credentials.
 */
function createSupabaseAuthStub(): SupabaseAuthService {
  const handler = new Proxy(
    {},
    {
      get: (_target, propertyKey) => {
        if (
          propertyKey === "then" ||
          propertyKey === Symbol.toStringTag ||
          propertyKey === "onModuleInit" ||
          propertyKey === "onModuleDestroy" ||
          propertyKey === "beforeApplicationShutdown" ||
          propertyKey === "onApplicationBootstrap" ||
          propertyKey === "onApplicationShutdown"
        ) {
          return undefined;
        }

        return () => {
          throw new Error(
            `SupabaseAuthService is disabled during OpenAPI generation (attempted to use "${String(propertyKey)}").`,
          );
        };
      },
    },
  );

  return handler as SupabaseAuthService;
}

/**
 * Provide a no-op cron task to prevent scheduled database work.
 */
function createCronStub<T extends Record<string, unknown>>(): T {
  return new Proxy(
    {},
    {
      get: () => () => undefined,
    },
  ) as T;
}

/**
 * Provide a lightweight notification queue stub.
 */
function createNotificationQueueStub(): NotificationQueueService {
  const noopAsync = async () => undefined;
  const noopStats = async () => ({
    total: 0,
    pending: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
  });

  return {
    enqueue: noopAsync,
    processDueNotifications: noopAsync,
    cancelBySessionId: async () => 0,
    updateBySessionId: async () => 0,
    getBySessionId: async () => [],
    getStatistics: noopStats,
    cleanupOldNotifications: noopAsync,
  } as unknown as NotificationQueueService;
}

generateOpenApiDocument()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Failed to generate OpenAPI specification:", error);
    process.exit(1);
  });
