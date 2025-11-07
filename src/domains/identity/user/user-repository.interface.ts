import { User, UserWithPassword } from "./user.interface";

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
  create(user: Partial<UserWithPassword>): Promise<User>;
  update(id: string, user: Partial<User>): Promise<User>;
}

export const USER_REPOSITORY = Symbol("USER_REPOSITORY");
