import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { v4 as uuidv4 } from "uuid";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import { IUserService, User, UserWithPassword } from "./user-interface";

/**
 * User Service
 * 用户服务
 *
 * 职责：
 * 1. 处理用户表的 CRUD 操作
 * 2. 实现 IUserService 接口
 * 3. 提供用户相关的业务逻辑
 */
@Injectable()
export class UserService implements IUserService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Find user by ID
   *
   * @param id - User ID
   * @returns User entity or null
   */
  async findById(id: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(schema.userTable)
      .where(eq(schema.userTable.id, id))
      .limit(1);

    return user ? this.mapToUser(user) : null;
  }

  /**
   * Find user by email
   *
   * @param email - User email
   * @returns User entity or null
   */
  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(schema.userTable)
      .where(eq(schema.userTable.email, email))
      .limit(1);

    return user ? this.mapToUser(user) : null;
  }

  /**
   * Find user by email with password
   *
   * @param email - User email
   * @returns User entity with password or null
   */
  async findByEmailWithPassword(
    email: string,
  ): Promise<UserWithPassword | null> {
    const [user] = await this.db
      .select()
      .from(schema.userTable)
      .where(eq(schema.userTable.email, email))
      .limit(1);

    return user ? this.mapToUserWithPassword(user) : null;
  }

  /**
   * Create a new user
   *
   * @param user - User data (email and password are required)
   * @param tx - Optional transaction
   * @returns Created user entity
   * @throws Error if email or password is missing
   */
  async create(
    user: Partial<UserWithPassword>,
    tx?: DrizzleTransaction,
  ): Promise<User> {
    // Validate required fields
    if (!user.email) {
      throw new Error("Email is required");
    }
    if (!user.password) {
      throw new Error("Password is required");
    }

    const executor: DrizzleExecutor = tx ?? this.db;

    const [created] = await executor
      .insert(schema.userTable)
      .values({
        id: user.id || this.generateId(),
        email: user.email,
        password: user.password,
        nickname: user.nickname || null,
        cnNickname: user.cnNickname || null,
        gender: user.gender || null,
        status: user.status || "active",
        country: user.country || null,
        createdBy: user.createdBy || null,
        updatedBy: user.updatedBy || null,
      })
      .returning();

    return this.mapToUser(created);
  }

  /**
   * Update user
   *
   * @param id - User ID
   * @param user - User data to update
   * @param tx - Optional transaction
   * @returns Updated user entity
   */
  async update(
    id: string,
    user: Partial<User>,
    tx?: DrizzleTransaction,
  ): Promise<User> {
    const executor: DrizzleExecutor = tx ?? this.db;

    // Build update values object with only provided fields
    const updateValues: Partial<typeof schema.userTable.$inferInsert> = {
      modifiedTime: new Date(),
    };

    if (user.email !== undefined) {
      updateValues.email = user.email;
    }
    if (user.nickname !== undefined) {
      updateValues.nickname = user.nickname;
    }
    if (user.cnNickname !== undefined) {
      updateValues.cnNickname = user.cnNickname;
    }
    if (user.gender !== undefined) {
      updateValues.gender = user.gender;
    }
    if (user.status !== undefined) {
      updateValues.status = user.status;
    }
    if (user.country !== undefined) {
      updateValues.country = user.country;
    }
    if (user.updatedBy !== undefined) {
      updateValues.updatedBy = user.updatedBy;
    }

    const [updated] = await executor
      .update(schema.userTable)
      .set(updateValues)
      .where(eq(schema.userTable.id, id))
      .returning();

    if (!updated) {
      throw new Error(`User with id ${id} not found`);
    }

    return this.mapToUser(updated);
  }

  /**
   * Map database record to User entity
   */
  private mapToUser(record: typeof schema.userTable.$inferSelect): User {
    return {
      id: record.id,
      email: record.email || undefined,
      nickname: record.nickname || undefined,
      cnNickname: record.cnNickname || undefined,
      gender: record.gender || undefined,
      status: record.status || undefined,
      country: record.country || undefined,
      createdTime: record.createdTime || undefined,
      modifiedTime: record.modifiedTime || undefined,
      createdBy: record.createdBy || undefined,
      updatedBy: record.updatedBy || undefined,
    };
  }

  /**
   * Map database record to UserWithPassword entity
   */
  private mapToUserWithPassword(
    record: typeof schema.userTable.$inferSelect,
  ): UserWithPassword {
    return {
      ...this.mapToUser(record),
      password: record.password || "",
    };
  }

  /**
   * Generate a unique user ID
   * Uses UUID v4 for generating unique identifiers
   */
  private generateId(): string {
    return uuidv4();
  }
}

