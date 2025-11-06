import { ConfigService } from '@nestjs/config';
import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as dns from 'dns';
import { promisify } from 'util';
import * as schema from './schema';

const resolve4 = promisify(dns.resolve4);

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

export const databaseProviders = [
  {
    provide: DATABASE_CONNECTION,
    inject: [ConfigService],
    useFactory: async (configService: ConfigService) => {
      const connectionString = configService.get<string>('DATABASE_URL');

      // Parse connection string to extract host
      const url = new URL(connectionString);
      const hostname = url.hostname;

      // Resolve hostname to IPv4 address
      let resolvedHost = hostname;
      try {
        const addresses = await resolve4(hostname);
        if (addresses && addresses.length > 0) {
          resolvedHost = addresses[0];
          console.log(`Resolved ${hostname} to IPv4 address: ${resolvedHost}`);
        }
      } catch (error) {
        console.warn(`Failed to resolve ${hostname} to IPv4, using hostname:`, error.message);
      }

      // Reconstruct connection string with resolved IPv4 address
      const resolvedUrl = new URL(connectionString);
      resolvedUrl.hostname = resolvedHost;

      const pool = new Pool({
        connectionString: resolvedUrl.toString(),
        ssl: {
          rejectUnauthorized: false, // Required for Supabase
        },
      });

      // Test the connection
      try {
        const client = await pool.connect();
        console.log('Database connection successful');
        client.release();
      } catch (error) {
        console.error('Database connection failed:', error);
        throw error;
      }

      const isDevelopment = configService.get('NODE_ENV') === 'development';

      return drizzle(pool, {
        schema,
        logger: isDevelopment,
      });
    },
  },
];
