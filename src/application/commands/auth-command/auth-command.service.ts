import { Injectable, UnauthorizedException, Inject } from "@nestjs/common";
import {
  IUserService,
  USER_SERVICE,
} from "@domains/identity/user/user-interface";
import { RegisterInput, LoginInput, AuthResult } from "@shared/types/auth.types";
import { RegisterCommand } from "@application/commands/auth/register.command";
import { LoginCommand } from "@application/commands/auth/login.command";

/**
 * Application Layer - Auth Command Service (兼容层)
 * 职责：为了保持向后兼容，委托给新的 Commands
 *
 * 注意：这是临时兼容层，新代码应该直接使用 RegisterCommand 和 LoginCommand
 * 
 * ⚠️ 警告：此服务仍接受 API DTO 作为参数，这是为了向后兼容。
 * 新代码应该直接使用 RegisterCommand 和 LoginCommand，并在 Controller 层进行映射。
 */
@Injectable()
export class AuthCommandService {
  constructor(
    @Inject(USER_SERVICE)
    private readonly userService: IUserService,
    private readonly registerCommand: RegisterCommand,
    private readonly loginCommand: LoginCommand,
  ) {}

  /**
   * @deprecated 此方法接受 API DTO，建议新代码在 Controller 层映射后直接调用 Command
   * 为了向后兼容，此方法内部进行映射
   */
  async register(registerDto: any): Promise<AuthResult> {
    const input: RegisterInput = {
      email: registerDto.email,
      password: registerDto.password,
      nameEn: registerDto.nameEn,
      nameZh: registerDto.nameZh,
      gender: registerDto.gender,
      country: registerDto.country,
      role: registerDto.role,
    };
    return this.registerCommand.execute(input);
  }

  /**
   * @deprecated 此方法接受 API DTO，建议新代码在 Controller 层映射后直接调用 Command
   * 为了向后兼容，此方法内部进行映射
   */
  async login(loginDto: any): Promise<AuthResult> {
    const input: LoginInput = {
      email: loginDto.email,
      password: loginDto.password,
    };
    return this.loginCommand.execute(input);
  }

  async validateUser(userId: string): Promise<any> {
    const user = await this.userService.findByIdWithRoles(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    if (user.status && user.status !== "active") {
      throw new UnauthorizedException("User account is not active");
    }
    return user;
  }
}
