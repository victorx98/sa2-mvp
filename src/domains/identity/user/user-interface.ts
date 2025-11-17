import type { DrizzleTransaction } from "@shared/types/database.types";

/**
 * User Interface
 * 用户实体接口定义
 */
export interface User {
  id: string;
  email: string;
  gender?: string;
  nickname?: string;
  cnNickname?: string;
  status?: string;
  country?: string;
  createdTime?: Date;
  modifiedTime?: Date;
  createdBy?: string;
  updatedBy?: string;
  roles?: string[];
}

/**
 * Create User Input
 * 创建用户所需字段
 */
export interface CreateUserInput {
  id: string;
  email: string;
  nickname?: string;
  cnNickname?: string;
  gender?: string;
  status?: string;
  country?: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * User Service Interface
 * 用户服务接口定义
 */
export interface IUserService {
  findById(id: string): Promise<User | null>;
  findByIdWithRoles(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: CreateUserInput, tx?: DrizzleTransaction): Promise<User>;
  createWithRoles(
    user: CreateUserInput,
    roles: string[],
    tx?: DrizzleTransaction,
  ): Promise<User>;
  authorizeRoles(
    userId: string,
    roles: string[],
    tx?: DrizzleTransaction,
  ): Promise<string[]>;
  getRolesByUserId(
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<string[]>;
  update(id: string, user: Partial<CreateUserInput>): Promise<User>;
}

/**
 * User Service Token
 * 用于依赖注入的 token
 */
export const USER_SERVICE = Symbol("USER_SERVICE");
