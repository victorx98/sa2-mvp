import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { UserReadModel } from '../models/user-read.model';
import { USER_QUERY_REPOSITORY, IUserQueryRepository } from '../interfaces/user-query.repository.interface';

@Injectable()
export class GetUserUseCase {
  constructor(
    @Inject(USER_QUERY_REPOSITORY)
    private readonly userQueryRepository: IUserQueryRepository,
  ) {}

  async getUserById(userId: string): Promise<UserReadModel> {
    const user = await this.userQueryRepository.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<UserReadModel> {
    const user = await this.userQueryRepository.getUserByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async getUsersByIds(userIds: string[]): Promise<UserReadModel[]> {
    return this.userQueryRepository.getUsersByIds(userIds);
  }
}
