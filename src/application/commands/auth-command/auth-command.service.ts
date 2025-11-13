import { Injectable, UnauthorizedException, Inject } from "@nestjs/common";
import {
  IUserService,
  USER_SERVICE,
} from "@domains/identity/user/user-interface";
import { RegisterDto } from "@api/dto/request/register.dto";
import { LoginDto } from "@api/dto/request/login.dto";
import { AuthResultDto } from "@application/commands/auth/dto/auth-result.dto";
import { RegisterCommand } from "@application/commands/auth/register.command";
import { LoginCommand } from "@application/commands/auth/login.command";

/**
 * Application Layer - Auth Command Service (兼容层)
 * 职责：为了保持向后兼容，委托给新的 Commands
 *
 * 注意：这是临时兼容层，新代码应该直接使用 RegisterCommand 和 LoginCommand
 */
@Injectable()
export class AuthCommandService {
  constructor(
    @Inject(USER_SERVICE)
    private readonly userService: IUserService,
    private readonly registerCommand: RegisterCommand,
    private readonly loginCommand: LoginCommand,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResultDto> {
    return this.registerCommand.execute(registerDto);
  }

  async login(loginDto: LoginDto): Promise<AuthResultDto> {
    return this.loginCommand.execute(loginDto);
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user;
  }
}
