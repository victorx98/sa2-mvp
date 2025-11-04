import { User, UserWithPassword } from './user.interface';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByAccount(account: string): Promise<User | null>;
  findByAccountWithPassword(account: string): Promise<UserWithPassword | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Partial<UserWithPassword>): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
