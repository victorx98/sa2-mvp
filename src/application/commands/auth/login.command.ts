import {
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  IUserService,
  USER_SERVICE,
} from "@domains/identity/user/user-interface";
import { LoginDto } from "@api/dto/request/login.dto";
import {
  SupabaseAuthException,
  SupabaseAuthService,
} from "@infrastructure/auth/supabase-auth.service";
import { AuthResultDto } from "./dto/auth-result.dto";

/**
 * Application Layer - Login Command
 * 职责：
 * 1. 实现用户登录业务用例
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
export class LoginCommand {
  constructor(
    @Inject(USER_SERVICE)
    private readonly userService: IUserService,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {}

  async execute(loginDto: LoginDto): Promise<AuthResultDto> {
    // Step 1: 调用 Supabase 进行密码认证
    let signInResult;
    try {
      signInResult = await this.supabaseAuthService.signInWithPassword({
        email: loginDto.email,
        password: loginDto.password,
      });
    } catch (error) {
      throw this.transformSupabaseError(error);
    }

    // Step 2: 查询业务用户信息（含角色）
    const user = await this.userService.findByIdWithRoles(
      signInResult.user.id,
    );
    if (!user) {
      throw new UnauthorizedException("User profile not found");
    }

    // Step 3: 检查用户状态
    if (user.status && user.status !== "active") {
      throw new UnauthorizedException("User account is not active");
    }

    return {
      accessToken: signInResult.accessToken,
      refreshToken: signInResult.refreshToken,
      expiresIn: signInResult.expiresIn,
      tokenType: signInResult.tokenType,
      user: {
        id: user.id,
        email: user.email,
        nameEn: user.nameEn,
        nameZh: user.nameZh,
        status: user.status,
        roles: user.roles ?? [],
      },
    };
  }

  private transformSupabaseError(error: unknown): Error {
    if (error instanceof SupabaseAuthException) {
      if (
        error.status &&
        [400, 401, 403, 422].includes(error.status)
      ) {
        return new UnauthorizedException("Invalid credentials");
      }
      return new InternalServerErrorException(error.message);
    }

    if (error instanceof UnauthorizedException) {
      return error;
    }

    if (error instanceof Error) {
      return new InternalServerErrorException(error.message);
    }

    return new UnauthorizedException("Invalid credentials");
  }
}
