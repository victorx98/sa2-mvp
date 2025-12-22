import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { Pool, PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { instrumentDrizzleClient } from "@kubiks/otel-drizzle";
import * as schema from "./schema";
import { createEnhancedDatabaseUrl } from "../../../drizzle.config";

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

      // Parse connection string to extract host for logging
      let hostname: string | null = null;
      let port: string | null = null;
      try {
        const url = new URL(connectionString);
        hostname = url.hostname;
        port = url.port || "5432";
        if (!isTest) {
          logger.log(`Connecting to database host: ${hostname}:${port}`);
        }
      } catch (error) {
        if (!isTest) {
          logger.warn(`Could not parse connection string for logging: ${error.message}`);
        }
      }

      // Detect if using Supabase connection pooler (port 6543)
      const isPooler = port === "6543" || hostname?.includes("pooler");
      if (!isTest && isPooler) {
        logger.log("Detected Supabase connection pooler - using optimized settings");
      }

      // Configure connection pool with enhanced reliability settings
      // Let pg library handle DNS resolution automatically - it's more reliable
      const poolConfig: PoolConfig = {
        connectionString: connectionString,
        ssl: {
          rejectUnauthorized: false, // Required for Supabase
        },
        // Connection pool settings
        // For Supabase pooler, use smaller pool sizes as pooler manages connections
        max: isTest ? 5 : (isPooler ? 10 : 20), // Maximum number of clients in the pool
        min: isTest ? 1 : (isPooler ? 1 : 2), // Minimum number of clients in the pool
        // Reduce idle timeout to prevent using stale connections that may be closed by Supabase
        idleTimeoutMillis: isTest ? 30000 : (isPooler ? 30000 : 60000), // Shorter timeout for pooler
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

      // Test the connection with retry mechanism and timeout
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (!isTest) {
            if (attempt > 1) {
              logger.log(`Connection attempt ${attempt}/${maxRetries}...`);
            } else {
              logger.log("Testing database connection...");
            }
          }
          
          // Connect - pg library's connectionTimeoutMillis will handle timeout
          // For Supabase pooler, connections may take longer to establish
          const client = await pool.connect();
          
          // Validate connection with a simple query
          try {
            await client.query('SELECT 1');
            if (!isTest) {
              logger.log("Database connection successful and validated");
            }
            client.release();
            break; // Success, exit retry loop
          } catch (queryError) {
            client.release(queryError);
            throw new Error(`Connection validation query failed: ${queryError.message}`);
          }
        } catch (error) {
          lastError = error as Error;
          
          // Log detailed error information for diagnosis
          if (!isTest) {
            const errorDetails: string[] = [
              `Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`,
            ];
            
            if (hostname) {
              errorDetails.push(`Host: ${hostname}:${port || 5432}`);
            }
            
            if (lastError.message.includes('timeout')) {
              errorDetails.push('Possible causes: Network connectivity issues, firewall blocking, or database server unreachable');
            } else if (lastError.message.includes('ECONNREFUSED')) {
              errorDetails.push('Possible causes: Database server not running or wrong host/port');
            } else if (lastError.message.includes('ENOTFOUND') || lastError.message.includes('getaddrinfo')) {
              errorDetails.push('Possible causes: DNS resolution failure, check network settings');
            } else if (lastError.message.includes('SSL') || lastError.message.includes('certificate')) {
              errorDetails.push('Possible causes: SSL/TLS configuration issue');
            }
            
            if (attempt < maxRetries) {
              const delayMs = 2000 * attempt; // Exponential backoff: 2s, 4s, 6s
              errorDetails.push(`Retrying in ${delayMs}ms...`);
              logger.warn(errorDetails.join(' | '));
            } else {
              errorDetails.push('All retry attempts exhausted');
              logger.error(errorDetails.join(' | '));
              logger.error(`Full error stack: ${lastError.stack}`);
            }
          }
          
          if (attempt < maxRetries) {
            const delayMs = 2000 * attempt; // Exponential backoff: 2s, 4s, 6s
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          } else {
            // Last attempt failed - clean up and throw
            try {
              await pool.end();
            } catch (cleanupError) {
              logger.warn(`Error during pool cleanup: ${cleanupError.message}`);
            }
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
        try {
          // 从连接字符串中提取数据库信息
          const url = new URL(connectionString);
          const dbName = url.pathname.slice(1); // 移除前导斜杠
          
          instrumentDrizzleClient(db, {
            dbSystem: "postgresql",
            dbName: dbName || undefined,
            peerName: hostname || undefined,
            peerPort: parseInt(port || "5432"),
            captureQueryText: true,
          });
        } catch (error) {
          logger.warn(`Failed to configure OpenTelemetry instrumentation: ${error.message}`);
        }
      }

      return db;
    },
  },
];
