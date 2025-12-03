import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { Pool, PoolConfig } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
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
      // const connectionString = configService.get<string>("DATABASE_URL");
      const connectionString = createEnhancedDatabaseUrl();
      const isTest =
        process.env.NODE_ENV === "test" ||
        process.env.JEST_WORKER_ID !== undefined;

      // Parse connection string to extract host
      const url = new URL(connectionString);
      const hostname = url.hostname;

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
          console.warn(
            `Failed to resolve ${hostname} to IPv4, using hostname:`,
            error.message,
          );
        }
      }

      // Reconstruct connection string with resolved IPv4 address
      const resolvedUrl = new URL(connectionString);
      resolvedUrl.hostname = resolvedHost;

      // Configure connection pool [配置连接池]
      const poolConfig: PoolConfig = {
        connectionString: resolvedUrl.toString(),
        ssl: {
          rejectUnauthorized: false, // Required for Supabase [Supabase需要]
        },
        // Connection pool settings [连接池设置]
        max: isTest ? 5 : 20, // Maximum number of clients in the pool [池中最大客户端数]
        min: isTest ? 1 : 2, // Minimum number of clients in the pool [池中最小客户端数]
        idleTimeoutMillis: isTest ? 30000 : 300000, // Close idle clients after 5 minutes (non-test) or 30s (test) [空闲连接超时]
        connectionTimeoutMillis: isTest ? 30000 : 60000, // Increased to 60s for WSL2 network latency [增加到60秒以应对WSL2网络延迟]
        // Keep connections alive by validating them before use [保持连接活跃]
        // This prevents using stale connections that were closed by the server [防止使用已被服务器关闭的陈旧连接]
        allowExitOnIdle: false, // Don't exit when pool is idle [池空闲时不退出]
      };

      const pool = new Pool(poolConfig);

      // Handle pool errors gracefully to prevent unhandled error events [优雅处理连接池错误，防止未处理的错误事件]
      pool.on("error", (err, client) => {
        logger.error(
          `Unexpected error on idle database client: ${err.message}`,
          err.stack,
        );
        // The pool will automatically remove the failed client and create a new one [连接池会自动移除失败的客户端并创建新的]
      });

      // Handle connection errors [处理连接错误]
      pool.on("connect", (client) => {
        // Log successful connection [记录成功连接]
        if (!isTest) {
          logger.debug(`New database client connected (total: ${pool.totalCount})`);
        }
        
        client.on("error", (err) => {
          logger.error(
            `Database client error: ${err.message}. Connection will be removed from pool.`,
            err.stack,
          );
        });
        
        // Monitor connection end [监控连接结束]
        client.on("end", () => {
          if (!isTest) {
            logger.debug("Database client connection ended");
          }
        });
      });

      // Monitor pool removal events [监控连接池移除事件]
      pool.on("remove", () => {
        if (!isTest) {
          logger.debug(
            `Database client removed from pool (total: ${pool.totalCount}, idle: ${pool.idleCount})`,
          );
        }
      });

      // Test the connection with retry logic and validation [使用重试逻辑和验证测试连接]
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds between retries [重试间隔2秒]
      
      while (retryCount <= maxRetries) {
        let client;
        try {
          // Acquire connection from pool [从连接池获取连接]
          client = await pool.connect();
          
          // Check if client was acquired successfully [检查客户端是否成功获取]
          if (!client) {
            throw new Error("pool.connect() returned undefined");
          }
          
          // Validate connection with a simple query [使用简单查询验证连接]
          await client.query("SELECT 1");
          
          if (!isTest) {
            logger.log("Database connection successful and validated");
          }
          
          // Release connection back to pool [将连接释放回连接池]
          client.release();
          break; // Exit loop if connection is successful [连接成功则退出循环]
        } catch (error) {
          // Ensure client is released on error [确保错误时释放客户端]
          if (client) {
            try {
              client.release(true); // Force release the bad connection [强制释放坏连接]
            } catch (releaseError) {
              // Ignore release errors [忽略释放错误]
              logger.warn(
                `Failed to release client: ${releaseError instanceof Error ? releaseError.message : String(releaseError)}`,
              );
            }
          }
          
          retryCount++;
          if (retryCount > maxRetries) {
            logger.error(
              `Database connection failed after ${maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`,
              error instanceof Error ? error.stack : undefined,
            );
            await pool.end(); // Clean up pool on initialization failure [初始化失败时清理连接池]
            throw error;
          }
          
          logger.warn(
            `Database connection attempt ${retryCount}/${maxRetries} failed: ${error instanceof Error ? error.message : String(error)}. Retrying in ${retryDelay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }

      const isDevelopment = configService.get("NODE_ENV") === "development";

      return drizzle(pool, {
        schema,
        logger: isDevelopment && !isTest,
      });
    },
  },
];
