import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { RegisterCommand } from "@application/commands/auth/register.command";
import { LoginCommand } from "@application/commands/auth/login.command";
import { RegisterDto } from "@api/dto/request/register.dto";
import { LoginDto } from "@api/dto/request/login.dto";
import { AuthResultDto } from "@application/commands/auth/dto/auth-result.dto";
import { Public } from "@shared/decorators/public.decorator";
import { ApiPrefix } from "@api/api.constants";

/**
 * API Layer - Auth Controller
 * 职责：
 * 1. 定义 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 Application Layer 服务
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 * ❌ 不进行数据转换（由 Application Layer 负责）
 */
@ApiTags("Authentication")
@Controller(`${ApiPrefix}/auth`)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    // ✅ 直接注入 Application Layer 服务
    private readonly registerCommand: RegisterCommand,
    private readonly loginCommand: LoginCommand,
  ) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "User registration" })
  @ApiResponse({
    status: 201,
    description: "Registration successful",
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResultDto> {
    this.logger.log(`[API]register: ${registerDto.email}`);
    // ✅ 直接调用 Application Layer 服务
    return this.registerCommand.execute(registerDto);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "User login" })
  @ApiResponse({
    status: 200,
    description: "Login successful",
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResultDto> {
    this.logger.log(`[API]login: ${loginDto.email}`);
    // ✅ 直接调用 Application Layer 服务
    return this.loginCommand.execute(loginDto);
  }
}
