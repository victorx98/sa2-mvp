import { Injectable, ConflictException, Inject } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import {
  IUserService,
  USER_SERVICE,
} from "@domains/identity/user/user-interface";
import { RegisterDto } from "@api/dto/request/register.dto";
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
  constructor(
    @Inject(USER_SERVICE)
    private readonly userService: IUserService,
    private readonly jwtService: JwtService,
  ) {}

  async execute(registerDto: RegisterDto): Promise<AuthResultDto> {
    // Step 1: 检查用户是否已存在
    const existingUserByEmail = await this.userService.findByEmail(
      registerDto.email,
    );
    if (existingUserByEmail) {
      throw new ConflictException("Email already exists");
    }

    // Step 2: 加密密码
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Step 3: 创建用户
    const user = await this.userService.create({
      ...registerDto,
      password: hashedPassword,
    });

    // Step 4: 生成 JWT token
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    // ✅ 返回业务数据（不是前端格式）
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        cnNickname: user.cnNickname,
        status: user.status,
      },
    };
  }
}
