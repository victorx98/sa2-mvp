import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { UserBffService } from "@operations/common-portal/user/user.service";
import { UserResponseDto } from "@operations/common-portal/user/dto/user-response.dto";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { CurrentUser } from "@shared/decorators/current-user.decorator";

/**
 * API Layer - User Controller
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
 * ❌ 不进行数据转换（由 BFF 层负责）
 */
@ApiTags("Users")
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    // ✅ 注入 BFF Service
    private readonly userBffService: UserBffService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "获取当前登录用户信息" })
  @ApiResponse({
    status: 200,
    description: "成功获取用户信息",
    type: UserResponseDto,
  })
  async getCurrentUser(@CurrentUser() user: any): Promise<UserResponseDto> {
    // ✅ 直接调用 BFF Service，返回前端格式
    return this.userBffService.getCurrentUser(user.userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "根据ID获取用户信息" })
  @ApiResponse({
    status: 200,
    description: "成功获取用户信息",
    type: UserResponseDto,
  })
  async getUserById(@Param("id") id: string): Promise<UserResponseDto> {
    // ✅ 直接调用 BFF Service，返回前端格式
    return this.userBffService.getUserById(id);
  }
}
