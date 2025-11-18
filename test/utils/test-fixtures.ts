import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";
import * as bcrypt from "bcrypt";
import { randomUUID } from "crypto";

/**
 * Test fixture factory for creating test data in database
 */
export class TestFixtures {
  constructor(private db: NodePgDatabase<typeof schema>) {}

  /**
   * Create a test user in database
   */
  async createUser(
    overrides: Partial<typeof schema.userTable.$inferInsert> = {},
  ): Promise<typeof schema.userTable.$inferSelect> {
    const timestamp = Date.now();
    const defaultUser = {
      id: randomUUID(),
      email: `test-${timestamp}@example.com`,
      password: await bcrypt.hash("Test123456", 10),
      username: `testuser-${timestamp}`,
      ...overrides,
    };

    const [user] = await this.db
      .insert(schema.userTable)
      .values(defaultUser)
      .returning();
    return user;
  }

  /**
   * Clean up all test data including users
   * WARNING: This will delete ALL data from catalog and user tables!
   */
  async cleanupAll(): Promise<void> {
    await this.db.delete(schema.userTable);
  }
}

/**
 * Create test fixtures instance
 */
export function createTestFixtures(
  db: NodePgDatabase<typeof schema>,
): TestFixtures {
  return new TestFixtures(db);
}
