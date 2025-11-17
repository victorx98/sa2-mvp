import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { UserQueryService } from "@application/queries/user-query.service";
import { User } from "@domains/identity/user/user-interface";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { CurrentUser } from "@shared/decorators/current-user.decorator";

/**
 * API Layer - User Controller
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
@ApiTags("Users")
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    // ✅ 直接注入 Application Layer 服务
    private readonly userQueryService: UserQueryService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Get current authenticated user" })
  @ApiResponse({
    status: 200,
    description: "User retrieved successfully",
  })
  async getCurrentUser(@CurrentUser() user: User): Promise<User> {
    return user;
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiResponse({
    status: 200,
    description: "User retrieved successfully",
  })
  async getUserById(@Param("id") id: string): Promise<User> {
    // ✅ 直接调用 Application Layer 服务
    return this.userQueryService.getUserById(id);
  }
}
