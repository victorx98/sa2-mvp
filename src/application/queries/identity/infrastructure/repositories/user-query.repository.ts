import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IUserService,
  USER_SERVICE,
} from '@domains/identity/user/user-interface';
import { USER_QUERY_REPOSITORY, IUserQueryRepository } from '../../interfaces/user-query.repository.interface';
import { UserReadModel } from '../../models/user-read.model';

@Injectable()
export class UserQueryRepository implements IUserQueryRepository {
  constructor(
    @Inject(USER_SERVICE)
    private readonly userService: IUserService,
  ) {}

  async getUserById(userId: string): Promise<UserReadModel | null> {
    const user = await this.userService.findByIdWithRoles(userId);
    if (!user) {
      return null;
    }
    return {
      id: user.id,
      email: user.email,
      nameEn: user.nameEn,
      nameZh: user.nameZh,
      status: user.status,
      country: user.country,
      gender: user.gender,
      roles: user.roles,
      createdTime: user.createdTime,
      modifiedTime: user.modifiedTime,
    };
  }

  async getUserByEmail(email: string): Promise<UserReadModel | null> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      return null;
    }
    const roles = await this.userService.getRolesByUserId(user.id);
    return {
      id: user.id,
      email: user.email,
      nameEn: user.nameEn,
      nameZh: user.nameZh,
      status: user.status,
      country: user.country,
      gender: user.gender,
      roles,
      createdTime: user.createdTime,
      modifiedTime: user.modifiedTime,
    };
  }

  async getUsersByIds(userIds: string[]): Promise<UserReadModel[]> {
    const users = await this.userService.findByIds(userIds);
    return users.map((user) => ({
      id: user.id,
      email: user.email,
      nameEn: user.nameEn,
      nameZh: user.nameZh,
      status: user.status,
      country: user.country,
      gender: user.gender,
      createdTime: user.createdTime,
      modifiedTime: user.modifiedTime,
    }));
  }
}
