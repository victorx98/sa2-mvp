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

      // Configure connection pool
      const poolConfig: PoolConfig = {
        connectionString: resolvedUrl.toString(),
        ssl: {
          rejectUnauthorized: false, // Required for Supabase
        },
        // Increase connection timeout for test environment
        connectionTimeoutMillis: isTest ? 10000 : 30000, // 10 seconds for tests, 30 seconds for production
        ...(isTest && {
          max: 5, // Limit connections in test environment
          idleTimeoutMillis: 30000,
        }),
      };

      const pool = new Pool(poolConfig);

      // Test the connection
      try {
        const client = await pool.connect();
        if (!isTest) {
          logger.log("Database connection successful");
        }
        client.release();
      } catch (error) {
        console.error("Database connection failed:", error);
        throw error;
      }

      const isDevelopment = configService.get("NODE_ENV") === "development";

      return drizzle(pool, {
        schema,
        logger: isDevelopment && !isTest,
      });
    },
  },
];
