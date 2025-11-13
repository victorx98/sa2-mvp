import { Injectable, Inject, NotFoundException } from "@nestjs/common";
import {
  IUserService,
  USER_SERVICE,
  User,
} from "@domains/identity/user/user-interface";

@Injectable()
export class UserQueryService {
  constructor(
    @Inject(USER_SERVICE)
    private readonly userService: IUserService,
  ) {}

  async getUserById(id: string): Promise<User> {
    const user = await this.userService.findById(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  async getUserByEmail(email: string): Promise<User> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }
}
