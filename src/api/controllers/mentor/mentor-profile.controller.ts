import { Controller, Get, Put, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { User } from "@domains/identity/user/user-interface";
import { ApiPrefix } from "@api/api.constants";
import { UpdateMentorProfileDto } from "@api/dto/request/update-mentor-profile.dto";
import { UpdateMentorProfileCommand } from "@application/commands/profile/update-mentor-profile.command";
import { MentorProfileQuery } from "@application/queries/mentor/mentor-profile.query";

/**
 * API Layer - Mentor Profile Controller
 * 职责：
 * 1. 定义导师档案的 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 Application Layer 服务
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 */
@ApiTags("Mentor Profile")
@Controller(`${ApiPrefix}/mentor/profile`)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("mentor")
@ApiBearerAuth()
export class MentorProfileController {
  constructor(
    private readonly updateMentorProfileCommand: UpdateMentorProfileCommand,
    private readonly mentorProfileQuery: MentorProfileQuery,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get mentor profile" })
  @ApiOkResponse({
    description: "Mentor profile retrieved successfully",
  })
  async getProfile(@CurrentUser() user: User) {
    return this.mentorProfileQuery.getProfile(user.id);
  }

  @Put()
  @ApiOperation({ summary: "Update mentor profile" })
  @ApiBody({ type: UpdateMentorProfileDto })
  @ApiOkResponse({
    description: "Mentor profile updated successfully",
  })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateMentorProfileDto,
  ): Promise<{ message: string }> {
    await this.updateMentorProfileCommand.execute(user.id, dto);
    return { message: "Mentor profile updated successfully" };
  }
}

