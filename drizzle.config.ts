import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
  schema: './src/infrastructure/database/schema/**/*.schema.ts',
  out: './src/infrastructure/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!.includes('?')
      ? `${process.env.DATABASE_URL!}&options=--search_path%3Dpublic`
      : `${process.env.DATABASE_URL!}?options=--search_path%3Dpublic`,
  },
  breakpoints: true,
} satisfies Config;
