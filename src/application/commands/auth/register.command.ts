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
import {
  SupabaseAuthException,
  SupabaseAuthService,
} from "@infrastructure/auth/supabase-auth.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type {
  DrizzleDatabase,
  DrizzleTransaction,
} from "@shared/types/database.types";
import { StudentProfileService } from "@domains/identity/student/student-profile.service";
import { MentorProfileService } from "@domains/identity/mentor/mentor-profile.service";
import { CounselorProfileService } from "@domains/identity/counselor/counselor-profile.service";
import { AuthResultDto } from "./dto/auth-result.dto";
import { RegisterInput } from "./dto/register.input";

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
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly studentProfileService: StudentProfileService,
    private readonly mentorProfileService: MentorProfileService,
    private readonly counselorProfileService: CounselorProfileService,
  ) {}

  async execute(input: RegisterInput): Promise<AuthResultDto> {
    // Step 1: 输入验证（角色合法性）
    const role = input.role;
    if (!USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }
    const roles = [role];

    // Step 1: 检查用户是否已存在
    const existingUserByEmail = await this.userService.findByEmail(
      input.email,
    );
    if (existingUserByEmail) {
      throw new ConflictException("Email already exists");
    }

    // Step 2: 调用 Supabase 创建 Auth 用户
    let authUserId: string | null = null;
    try {
      const authUser = await this.supabaseAuthService.createUser({
        email: input.email,
        password: input.password,
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
      const user = await this.db.transaction(async (tx) => {
        const createdUser = await this.userService.createWithRoles(
          {
            id: authUserId,
            email: input.email,
            nameEn: input.nameEn,
            nameZh: input.nameZh,
            gender: input.gender,
            country: input.country,
            status: "active",
          },
          roles,
          tx,
        );

        await this.createRoleProfiles(createdUser.id, roles, tx);
        return createdUser;
      });

      // Step 4: 登录获取访问令牌（保持与旧接口兼容）
      const signInResult =
        await this.supabaseAuthService.signInWithPassword({
          email: input.email,
          password: input.password,
        });

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

  private async createRoleProfiles(
    userId: string,
    roles: string[],
    tx: DrizzleTransaction,
  ): Promise<void> {
    const roleSet = new Set(roles);

    if (roleSet.has("student")) {
      await this.studentProfileService.ensureProfile(userId, tx);
    }

    if (roleSet.has("mentor")) {
      await this.mentorProfileService.ensureProfile(userId, tx);
    }

    if (roleSet.has("counselor")) {
      await this.counselorProfileService.ensureProfile(userId, tx);
    }
  }
}
