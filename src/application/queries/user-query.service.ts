import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "@domains/identity/user/user-repository.interface";
import { User } from "@domains/identity/user/user.interface";

@Injectable()
export class UserQueryService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }
}
