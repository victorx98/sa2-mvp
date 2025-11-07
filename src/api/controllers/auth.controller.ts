import { Controller, Post, Body, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { AuthBffService } from "@operations/common-portal/auth/auth.service";
import { RegisterDto } from "@api/dto/request/register.dto";
import { LoginDto } from "@api/dto/request/login.dto";
import { AuthResponseDto } from "@operations/common-portal/auth/dto/auth-response.dto";
import { Public } from "@shared/decorators/public.decorator";

/**
 * API Layer - Auth Controller
 * 职责：
 * 1. 定义 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 BFF Service
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 注入 BFF Service（Operations Layer）
 * ❌ 不包含业务逻辑
 * ❌ 不直接调用 Application/Domain Layer
 */
@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(
    // ✅ 注入 BFF Service
    private readonly authBffService: AuthBffService,
  ) {}

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "用户注册" })
  @ApiResponse({
    status: 201,
    description: "注册成功",
    type: AuthResponseDto,
  })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    // ✅ 直接调用 BFF Service，返回前端格式
    return this.authBffService.register(registerDto);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "用户登录" })
  @ApiResponse({
    status: 200,
    description: "登录成功",
    type: AuthResponseDto,
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    // ✅ 直接调用 BFF Service，返回前端格式
    return this.authBffService.login(loginDto);
  }
}
