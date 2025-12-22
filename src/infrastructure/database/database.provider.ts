import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { Pool, PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { instrumentDrizzleClient } from "@kubiks/otel-drizzle";
import * as dns from "dns";
import { promisify } from "util";
import * as schema from "./schema";
import { createEnhancedDatabaseUrl } from "../../../drizzle.config";

const resolve4 = promisify(dns.resolve4);
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

      // 检查 DATABASE_URL 是否存在
      if (!process.env.DATABASE_URL) {
        const error = new Error(
          "DATABASE_URL environment variable is not set",
        );
        logger.error(error.message);
        throw error;
      }

      const connectionString = createEnhancedDatabaseUrl();
      
      if (!isTest) {
        logger.log("Initializing database connection...");
      }

      // Parse connection string to extract host
      let url: URL;
      try {
        url = new URL(connectionString);
      } catch (error) {
        const err = new Error(
          `Invalid DATABASE_URL format: ${error.message}`,
        );
        logger.error(err.message);
        throw err;
      }

      const hostname = url.hostname;
      if (!isTest) {
        logger.log(`Connecting to database host: ${hostname}:${url.port || 5432}`);
      }

      // Resolve hostname to IPv4 address for both test and production
      let resolvedHost = hostname;
      try {
        const addresses = await resolve4(hostname);
        if (addresses && addresses.length > 0) {
          resolvedHost = addresses[0];
          if (!isTest) {
            logger.log(`Resolved ${hostname} to IPv4 address: ${resolvedHost}`);
          }
        }
      } catch (error) {
        // DNS resolution failed - hostname may only support IPv6
        // or network may have DNS issues
        if (!isTest) {
          logger.warn(
            `Failed to resolve ${hostname} to IPv4, using hostname: ${error.message}`,
          );
        }
      }

      // Reconstruct connection string with resolved IPv4 address
      const resolvedUrl = new URL(connectionString);
      resolvedUrl.hostname = resolvedHost;

      // Configure connection pool with enhanced reliability settings
      const poolConfig: PoolConfig = {
        connectionString: resolvedUrl.toString(),
        ssl: {
          rejectUnauthorized: false, // Required for Supabase
        },
        // Connection pool settings
        max: isTest ? 5 : 20, // Maximum number of clients in the pool
        min: isTest ? 1 : 2, // Minimum number of clients in the pool
        // Reduce idle timeout to prevent using stale connections that may be closed by Supabase
        idleTimeoutMillis: isTest ? 30000 : 60000, // Close idle clients after 1 minute (non-test) or 30s (test)
        connectionTimeoutMillis: 120000, // 120 seconds to match connect_timeout in connection string
        // Keep connections alive by validating them before use
        // This prevents using stale connections that were closed by the server
        allowExitOnIdle: false, // Don't exit when pool is idle
        // Query timeout to prevent hanging queries
        query_timeout: 30000, // 30 seconds query timeout
      };

      const pool = new Pool(poolConfig);

      // Handle pool errors gracefully to prevent unhandled error events
      pool.on("error", (err) => {
        logger.error(
          `Unexpected error on idle database client: ${err.message}`,
          err.stack,
        );
        // The pool will automatically remove the failed client
        // Do NOT manually release here as the client is already removed from the pool
      });

      // Handle connection errors and validate connections
      pool.on("connect", (client) => {
        // Validate connection immediately after connect
        client.query('SELECT 1').catch((err) => {
          logger.error(`Connection validation failed: ${err.message}`);
          client.release(err);
        });

        client.on("error", (err) => {
          logger.error(`Database client error: ${err.message}`, err.stack);
        });
      });

      // Test the connection with retry mechanism
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (!isTest && attempt > 1) {
            logger.log(`Connection attempt ${attempt}/${maxRetries}...`);
          }
          
          const client = await pool.connect();
          if (!isTest) {
            logger.log("Database connection successful");
          }
          client.release();
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error as Error;
          if (attempt < maxRetries) {
            const delayMs = 2000 * attempt; // Exponential backoff: 2s, 4s, 6s
            if (!isTest) {
              logger.warn(
                `Database connection attempt ${attempt} failed: ${lastError.message}. Retrying in ${delayMs}ms...`,
              );
            }
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            // Last attempt failed
            logger.error(
              `Database connection failed after ${maxRetries} attempts: ${lastError.message}`,
              lastError.stack,
            );
            await pool.end(); // Clean up pool on initialization failure
            throw lastError;
          }
        }
      }

      const isDevelopment = configService.get("NODE_ENV") === "development";
      const isTelemetryEnabled = process.env.OTEL_ENABLED !== "false";

      // 创建基础的 Drizzle 客户端
      const db = drizzle(pool, {
        schema,
        logger: isDevelopment && !isTest,
      });

      // 如果启用了 OpenTelemetry 且不在测试环境，使用 instrumentDrizzleClient 包装
      // instrumentDrizzleClient 会自动追踪所有 SQL 查询，包括 SQL 语句、执行时长、操作类型等
      if (isTelemetryEnabled && !isTest) {
        // 从连接字符串中提取数据库信息
        const url = new URL(resolvedUrl.toString());
        const dbName = url.pathname.slice(1); // 移除前导斜杠
        
        instrumentDrizzleClient(db, {
          dbSystem: "postgresql",
          dbName: dbName || undefined,
          peerName: resolvedHost,
          peerPort: parseInt(url.port) || 5432,
          captureQueryText: true,
        });
      }

      return db;
    },
  },
];
