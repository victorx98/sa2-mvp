import { Injectable } from '@nestjs/common';
import { AuthCommandService } from '@application/commands/auth-command/auth-command.service';
import { RegisterDto } from '@api/dto/request/register.dto';
import { LoginDto } from '@api/dto/request/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

/**
 * BFF Layer - Auth Service
 * 职责：
 * 1. 调用 Application Layer 的业务逻辑
 * 2. 将业务数据转换为前端特定格式
 * 3. 添加前端需要的提示信息
 *
 * 设计原则：
 * ✅ 只注入 Application Layer 的 Service
 * ❌ 不直接注入 Domain Service
 * ✅ 返回前端特定格式（Response DTO）
 */
@Injectable()
export class AuthBffService {
  constructor(
    // ✅ 只注入 Application Layer
    private readonly authCommandService: AuthCommandService,
  ) {}

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    // 1. 调用 Application Layer 获取业务数据
    const result = await this.authCommandService.register(registerDto);

    // 2. 转换为前端特定格式并添加提示信息
    return {
      ...result,
      message: `欢迎加入 MentorX，${result.user.nickname || result.user.email}！`,
      hints: [
        '🎉 注册成功！',
        '💡 建议：完善您的个人资料以获得更好的体验',
        '📚 您可以开始浏览我们的服务和导师',
      ],
    };
  }

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    // 1. 调用 Application Layer 获取业务数据
    const result = await this.authCommandService.login(loginDto);

    // 2. 转换为前端特定格式并添加提示信息
    return {
      ...result,
      message: `欢迎回来，${result.user.nickname || result.user.email}！`,
      hints: [
        '✅ 登录成功！',
      ],
    };
  }
}
