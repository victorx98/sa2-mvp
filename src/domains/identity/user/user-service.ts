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
import {
  CreateUserInput,
  IUserService,
  User,
} from "./user-interface";

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
   * Find user by ID with roles
   *
   * @param id - User ID
   * @returns User entity including roles or null
   */
  async findByIdWithRoles(id: string): Promise<User | null> {
    const rows = await this.db
      .select({
        user: schema.userTable,
        roleId: schema.userRolesTable.roleId,
      })
      .from(schema.userTable)
      .leftJoin(
        schema.userRolesTable,
        eq(schema.userRolesTable.userId, schema.userTable.id),
      )
      .where(eq(schema.userTable.id, id));

    if (rows.length === 0 || !rows[0].user) {
      return null;
    }

    const user = this.mapToUser(rows[0].user);
    const roles = Array.from(
      new Set(
        rows
          .map((row) => row.roleId)
          .filter((roleId): roleId is string => !!roleId),
      ),
    );

    return {
      ...user,
      roles,
    };
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
   * Create a new user
   *
   * @param user - User data (email is required)
   * @param tx - Optional transaction
   * @returns Created user entity
   * @throws Error if email is missing
   */
  async create(user: CreateUserInput, tx?: DrizzleTransaction): Promise<User> {
    // Validate required fields
    if (!user.email) {
      throw new Error("Email is required");
    }

    const executor: DrizzleExecutor = tx ?? this.db;

    const [created] = await executor
      .insert(schema.userTable)
      .values({
        id: user.id || uuidv4(),
        email: user.email,
        nickname: user.nickname || null,
        cnNickname: user.cnNickname || null,
        gender: user.gender || null,
        status: user.status || "active",
        country: user.country || null,
      })
      .returning();

    return this.mapToUser(created);
  }

  /**
   * Create a new user with roles in a transactional way
   *
   * @param user - User data
   * @param roles - Roles to assign
   * @param tx - Optional transaction
   * @returns Created user entity with roles
   */
  async createWithRoles(
    user: CreateUserInput,
    roles: string[],
    tx?: DrizzleTransaction,
  ): Promise<User> {
    if (!roles || roles.length === 0) {
      throw new Error("At least one role is required");
    }

    const createdUser = await this.create(user, tx);
    await this.authorizeRoles(createdUser.id, roles, tx);
    return {
      ...createdUser,
      roles: await this.getRolesByUserId(createdUser.id, tx),
    };
  }

  /**
   * Assign roles to user
   *
   * @param userId - User ID
   * @param roles - Roles to assign
   * @param tx - Optional transaction
   * @returns Assigned roles
   */
  async authorizeRoles(
    userId: string,
    roles: string[],
    tx?: DrizzleTransaction,
  ): Promise<string[]> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const uniqueRoles = Array.from(new Set(roles));

    if (uniqueRoles.length === 0) {
      return [];
    }

    await executor.insert(schema.userRolesTable).values(
      uniqueRoles.map((role) => ({
        id: uuidv4(),
        userId,
        roleId: role,
        status: "active",
      })),
    );

    return uniqueRoles;
  }

  /**
   * Get user roles by user ID
   *
   * @param userId - User ID
   * @param tx - Optional transaction
   * @returns Array of role IDs
   */
  async getRolesByUserId(
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<string[]> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const result = await executor
      .select({
        roleId: schema.userRolesTable.roleId,
      })
      .from(schema.userRolesTable)
      .where(eq(schema.userRolesTable.userId, userId));

    return result.map((row) => row.roleId);
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
    user: Partial<CreateUserInput>,
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
    const [updated] = await executor
      .update(schema.userTable)
      .set(updateValues)
      .where(eq(schema.userTable.id, id))
      .returning();

    if (!updated) {
      throw new Error(`User with id ${id} not found`);
    }

    return {
      ...this.mapToUser(updated),
      roles: await this.getRolesByUserId(id, tx),
    };
  }

  /**
   * Map database record to User entity
   */
  private mapToUser(record: typeof schema.userTable.$inferSelect): User {
    return {
      id: record.id,
      email: record.email || "",
      nickname: record.nickname || undefined,
      cnNickname: record.cnNickname || undefined,
      gender: record.gender || undefined,
      status: record.status || undefined,
      country: record.country || undefined,
      createdTime: record.createdTime || undefined,
      modifiedTime: record.modifiedTime || undefined,
    };
  }

}
