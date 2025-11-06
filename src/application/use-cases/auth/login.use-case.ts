import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { IUserRepository, USER_REPOSITORY } from '@domains/identity/user/user-repository.interface';
import { LoginDto } from '@api/dto/request/login.dto';
import { AuthResultDto } from './dto/auth-result.dto';

/**
 * Application Layer - Login UseCase
 * 职责：
 * 1. 实现用户登录业务用例
 * 2. 协调 Domain 层完成业务流程
 * 3. 返回业务数据（不是前端格式）
 *
 * 设计原则：
 * ✅ 注入 Domain Service/Repository
 * ✅ 包含业务规则验证
 * ✅ 返回业务 DTO（可被多个 BFF 复用）
 * ❌ 不返回前端特定格式
 * ❌ 不包含 HTTP 相关操作
 */
@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(loginDto: LoginDto): Promise<AuthResultDto> {
    // Step 1: 查找用户（包含密码）
    const user = await this.userRepository.findByEmailWithPassword(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Step 2: 验证密码
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Step 3: 检查用户状态
    if (user.status && user.status !== 'active') {
      throw new UnauthorizedException('User account is not active');
    }

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
