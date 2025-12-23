import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { Pool, PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { instrumentDrizzleClient } from "@kubiks/otel-drizzle";
import * as schema from "./schema";
import { createEnhancedDatabaseUrl } from "./utils/database-url.utils";

const logger = new Logger("DatabaseProvider");

export const DATABASE_CONNECTION = "DATABASE_CONNECTION";

export const databaseProviders = [
  {
    provide: DATABASE_CONNECTION,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
      const isTest =
        process.env.NODE_ENV === "test" ||
        process.env.JEST_WORKER_ID !== undefined;

      const connectionString = createEnhancedDatabaseUrl();

      const url = new URL(connectionString);
      const port = url.port || "5432";
      const isPooler = port === "6543" || url.hostname?.includes("pooler");

      const poolConfig: PoolConfig = {
        connectionString,
        ssl: {
          rejectUnauthorized: false,
        },
        max: isTest ? 5 : (isPooler ? 10 : 20),
        min: isTest ? 1 : (isPooler ? 1 : 2),
        idleTimeoutMillis: isTest ? 30000 : (isPooler ? 30000 : 60000),
        connectionTimeoutMillis: 120000,
        allowExitOnIdle: false,
        query_timeout: 30000,
      };

      const pool = new Pool(poolConfig);

      pool.on("error", (err) => {
        logger.error(`Database pool error: ${err.message}`, err.stack);
      });

      pool.on("connect", (client) => {
        client.on("error", (err) => {
          logger.error(`Database client error: ${err.message}`, err.stack);
        });
      });

      const db = drizzle(pool, {
        schema,
        logger: configService.get("NODE_ENV") === "development" && !isTest,
      });

      if (process.env.OTEL_ENABLED !== "false" && !isTest) {
        try {
          const dbName = url.pathname.slice(1);
          instrumentDrizzleClient(db, {
            dbSystem: "postgresql",
            dbName: dbName || undefined,
            peerName: url.hostname || undefined,
            peerPort: parseInt(port || "5432"),
            captureQueryText: true,
          });
        } catch (error) {
          logger.warn(`Failed to configure OpenTelemetry: ${error.message}`);
        }
      }

      return db;
    },
  },
];
