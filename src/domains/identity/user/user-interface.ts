import type { DrizzleTransaction } from "@shared/types/database.types";
import { Gender, Country } from "@shared/types/identity-enums";

/**
 * User Interface
 * 用户实体接口定义
 */
export interface User {
  id: string;
  email: string;
  gender?: Gender;
  nameEn?: string;
  nameZh?: string;
  status?: string;
  country?: Country;
  createdTime?: Date;
  modifiedTime?: Date;
  roles?: string[];
}

/**
 * Create User Input
 * 创建用户所需字段
 */
export interface CreateUserInput {
  id: string;
  email: string;
  nameEn?: string;
  nameZh?: string;
  gender?: Gender;
  status?: string;
  country?: Country;
}

/**
 * User Service Interface
 * 用户服务接口定义
 */
export interface IUserService {
  findById(id: string): Promise<User | null>;
  findByIdWithRoles(id: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
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
  update(
    id: string,
    user: Partial<CreateUserInput>,
    tx?: DrizzleTransaction,
  ): Promise<User>;
}

/**
 * User Service Token
 * 用于依赖注入的 token
 */
export const USER_SERVICE = Symbol("USER_SERVICE");
