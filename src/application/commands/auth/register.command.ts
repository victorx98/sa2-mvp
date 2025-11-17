import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import {
  IUserService,
  USER_SERVICE,
} from "@domains/identity/user/user-interface";
import { USER_ROLES } from "@domains/identity/user/user.constants";
import { RegisterDto } from "@api/dto/request/register.dto";
import {
  SupabaseAuthException,
  SupabaseAuthService,
} from "@infrastructure/auth/supabase-auth.service";
import { AuthResultDto } from "./dto/auth-result.dto";

/**
 * Application Layer - Register Command
 * 职责：
 * 1. 实现用户注册业务用例
 * 2. 协调 Domain 层完成业务流程
 * 3. 返回业务数据（不是前端格式）
 *
 * 设计原则：
 * ✅ 注入 Domain Service
 * ✅ 包含业务规则验证
 * ✅ 返回业务 DTO（可被多个 BFF 复用）
 * ❌ 不返回前端特定格式
 * ❌ 不包含 HTTP 相关操作
 */
@Injectable()
export class RegisterCommand {
  private readonly logger = new Logger(RegisterCommand.name);

  constructor(
    @Inject(USER_SERVICE)
    private readonly userService: IUserService,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {}

  async execute(registerDto: RegisterDto): Promise<AuthResultDto> {
    // Step 1: 输入验证（角色合法性）
    const role = registerDto.role;
    if (!USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    const roles = [role];

    // Step 1: 检查用户是否已存在
    const existingUserByEmail = await this.userService.findByEmail(
      registerDto.email,
    );
    if (existingUserByEmail) {
      throw new ConflictException("Email already exists");
    }

    // Step 2: 调用 Supabase 创建 Auth 用户
    let authUserId: string | null = null;
    try {
      const authUser = await this.supabaseAuthService.createUser({
        email: registerDto.email,
        password: registerDto.password,
      });
      authUserId = authUser.id;
    } catch (error) {
      throw this.transformSupabaseError(error);
    }

    if (!authUserId) {
      throw new InternalServerErrorException("Failed to create auth user");
    }

    // Step 3: 创建业务用户 & 角色（事务）
    try {
      const user = await this.userService.createWithRoles(
        {
          id: authUserId,
          email: registerDto.email,
          nickname: registerDto.nickname,
          cnNickname: registerDto.cnNickname,
          gender: registerDto.gender,
          country: registerDto.country,
          status: "active",
          createdBy: authUserId,
          updatedBy: authUserId,
        },
        roles,
      );

      // Step 4: 登录获取访问令牌（保持与旧接口兼容）
      const signInResult =
        await this.supabaseAuthService.signInWithPassword({
          email: registerDto.email,
          password: registerDto.password,
        });

      return {
        accessToken: signInResult.accessToken,
        refreshToken: signInResult.refreshToken,
        expiresIn: signInResult.expiresIn,
        tokenType: signInResult.tokenType,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          cnNickname: user.cnNickname,
          status: user.status ?? "active",
          roles: user.roles ?? roles,
        },
      };
    } catch (error) {
      await this.compensateAuthUser(authUserId);
      throw this.normalizeDomainError(error);
    }
  }

  private transformSupabaseError(error: unknown): Error {
    if (error instanceof SupabaseAuthException) {
      if (error.status && [409, 422].includes(error.status)) {
        return new ConflictException("Email already exists");
      }
      if (error.status && error.status >= 400 && error.status < 500) {
        return new BadRequestException(error.message);
      }
      return new InternalServerErrorException(error.message);
    }
    if (error instanceof Error) {
      return error;
    }
    return new InternalServerErrorException("Supabase Auth error");
  }

  private async compensateAuthUser(userId: string): Promise<void> {
    try {
      await this.supabaseAuthService.deleteUser(userId);
    } catch (error) {
      this.logger.error(
        `Failed to compensate Supabase user ${userId}`,
        (error as Error)?.stack,
      );
    }
  }

  private normalizeDomainError(error: unknown): Error {
    if (
      error instanceof ConflictException ||
      error instanceof BadRequestException
    ) {
      return error;
    }
    if (error instanceof SupabaseAuthException) {
      return new InternalServerErrorException(error.message);
    }
    if (error instanceof Error) {
      return error;
    }
    return new InternalServerErrorException("Failed to register user");
  }
}
