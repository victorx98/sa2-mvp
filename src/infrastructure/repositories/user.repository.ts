import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { v4 as uuidv4 } from 'uuid';
import { IUserRepository } from '@domains/identity/user/user-repository.interface';
import { User, UserWithPassword } from '@domains/identity/user/user.interface';
import { DATABASE_CONNECTION } from '../database/database.provider';
import * as schema from '../database/schema';
import { userTable } from '../database/schema';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.db
      .select({
        id: userTable.id,
        gender: userTable.gender,
        nickname: userTable.nickname,
        cnNickname: userTable.cnNickname,
        status: userTable.status,
        email: userTable.email,
        country: userTable.country,
        createdTime: userTable.createdTime,
        modifiedTime: userTable.modifiedTime,
        createdBy: userTable.createdBy,
        updatedBy: userTable.updatedBy,
      })
      .from(userTable)
      .where(eq(userTable.id, id))
      .limit(1);

    return result[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select({
        id: userTable.id,
        gender: userTable.gender,
        nickname: userTable.nickname,
        cnNickname: userTable.cnNickname,
        status: userTable.status,
        email: userTable.email,
        country: userTable.country,
        createdTime: userTable.createdTime,
        modifiedTime: userTable.modifiedTime,
        createdBy: userTable.createdBy,
        updatedBy: userTable.updatedBy,
      })
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);

    return result[0] || null;
  }

  async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
    const result = await this.db
      .select()
      .from(userTable)
      .where(eq(userTable.email, email))
      .limit(1);

    return result[0] || null;
  }

  async create(userData: Partial<UserWithPassword>): Promise<User> {
    const id = uuidv4().replace(/-/g, '').substring(0, 32);

    const [savedUser] = await this.db
      .insert(userTable)
      .values({
        ...userData,
        id,
        status: userData.status || 'active',
      })
      .returning({
        id: userTable.id,
        gender: userTable.gender,
        nickname: userTable.nickname,
        cnNickname: userTable.cnNickname,
        status: userTable.status,
        email: userTable.email,
        country: userTable.country,
        createdTime: userTable.createdTime,
        modifiedTime: userTable.modifiedTime,
        createdBy: userTable.createdBy,
        updatedBy: userTable.updatedBy,
      });

    return savedUser;
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    const [updatedUser] = await this.db
      .update(userTable)
      .set(userData)
      .where(eq(userTable.id, id))
      .returning({
        id: userTable.id,
        gender: userTable.gender,
        nickname: userTable.nickname,
        cnNickname: userTable.cnNickname,
        status: userTable.status,
        email: userTable.email,
        country: userTable.country,
        createdTime: userTable.createdTime,
        modifiedTime: userTable.modifiedTime,
        createdBy: userTable.createdBy,
        updatedBy: userTable.updatedBy,
      });

    return updatedUser;
  }
}
