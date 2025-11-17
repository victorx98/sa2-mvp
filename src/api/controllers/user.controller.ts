import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { UserQueryService } from "@application/queries/user-query.service";
import { User } from "@domains/identity/user/user-interface";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { ApiPrefix } from "@api/api.constants";
import { UserResponseDto } from "@api/dto/response/user-response.dto";
import { plainToInstance } from "class-transformer";

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
@Controller(`${ApiPrefix}/users`)
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(
    // ✅ 直接注入 Application Layer 服务
    private readonly userQueryService: UserQueryService,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Get current authenticated user" })
  @ApiOkResponse({
    description: "User retrieved successfully",
    type: UserResponseDto,
  })
  async getCurrentUser(@CurrentUser() user: User): Promise<UserResponseDto> {
    return this.toUserResponseDto(user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiOkResponse({
    description: "User retrieved successfully",
    type: UserResponseDto,
  })
  async getUserById(@Param("id") id: string): Promise<UserResponseDto> {
    // ✅ 直接调用 Application Layer 服务
    const user = await this.userQueryService.getUserById(id);
    return this.toUserResponseDto(user);
  }

  private toUserResponseDto(user: User): UserResponseDto {
    return plainToInstance(
      UserResponseDto,
      {
        ...user,
        roles: user.roles ?? [],
      },
      { enableImplicitConversion: false },
    );
  }
}
