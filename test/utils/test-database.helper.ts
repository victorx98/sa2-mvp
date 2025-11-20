import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";
import { sql } from "drizzle-orm";

/**
 * Test database helper class for managing database connections and cleanup in tests
 */
export class TestDatabaseHelper {
  private moduleRef: TestingModule;
  private db: NodePgDatabase<typeof schema>;

  /**
   * Initialize test database connection
   */
  async initialize(): Promise<void> {
    this.moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        DatabaseModule,
      ],
    }).compile();

    this.db =
      this.moduleRef.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
  }

  /**
   * Get database instance
   */
  getDatabase(): NodePgDatabase<typeof schema> {
    return this.db;
  }

  /**
   * Get module reference for injecting providers
   */
  getModuleRef(): TestingModule {
    return this.moduleRef;
  }

  /**
   * Clean up all test data from database
   */
  async cleanup(): Promise<void> {
    if (!this.db) return;

    try {
      // Delete in reverse order of dependencies to avoid foreign key constraints
      // Simplified to only cleanup tables that currently exist in schema
      await this.db.delete(schema.productItems);
      await this.db.delete(schema.products);
      await this.db.delete(schema.serviceTypes);
      await this.db.delete(schema.userTable);
    } catch (error) {
      console.error("Error cleaning up test data:", error);
    }
  }

  /**
   * Clean up specific tables
   */
  async cleanupTables(tables: string[]): Promise<void> {
    if (!this.db) return;

    for (const table of tables) {
      try {
        await this.db.execute(sql.raw(`TRUNCATE TABLE ${table} CASCADE`));
      } catch (error) {
        console.error(`Error cleaning up table ${table}:`, error);
      }
    }
  }

  /**
   * Close database connection and cleanup module
   */
  async close(): Promise<void> {
    if (this.moduleRef) {
      await this.moduleRef.close();
    }
  }

  /**
   * Execute raw SQL query
   */
  async execute(query: string): Promise<void> {
    await this.db.execute(sql.raw(query));
  }
}

/**
 * Create a test database helper instance
 */
export async function createTestDatabaseHelper(): Promise<TestDatabaseHelper> {
  const helper = new TestDatabaseHelper();
  await helper.initialize();
  return helper;
}
