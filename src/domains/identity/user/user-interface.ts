/**
 * User Interface
 * 用户实体接口定义
 */
export interface User {
  id: string;
  gender?: string;
  nickname?: string;
  cnNickname?: string;
  status?: string;
  email?: string;
  country?: string;
  createdTime?: Date;
  modifiedTime?: Date;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * User with Password Interface
 * 包含密码的用户实体接口
 */
export interface UserWithPassword extends User {
  password: string;
}

/**
 * User Service Interface
 * 用户服务接口定义
 */
export interface IUserService {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
  create(user: Partial<UserWithPassword>): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
}

/**
 * User Service Token
 * 用于依赖注入的 token
 */
export const USER_SERVICE = Symbol("USER_SERVICE");

