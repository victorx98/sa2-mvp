import { Controller, Put, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth, ApiBody } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { User } from "@domains/identity/user/user-interface";
import { ApiPrefix } from "@api/api.constants";
import { UpdateCounselorProfileDto } from "@api/dto/request/update-counselor-profile.dto";
import { UpdateCounselorProfileCommand } from "@application/commands/profile/update-counselor-profile.command";

/**
 * API Layer - Counselor Profile Controller
 * 职责：
 * 1. 定义咨询师档案的 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 Application Layer 服务
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 */
@ApiTags("Counselor Profile")
@Controller(`${ApiPrefix}/counselor/profile`)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("counselor")
@ApiBearerAuth()
export class CounselorProfileController {
  constructor(
    private readonly updateCounselorProfileCommand: UpdateCounselorProfileCommand,
  ) {}

  @Put()
  @ApiOperation({ summary: "Update counselor profile" })
  @ApiBody({ type: UpdateCounselorProfileDto })
  @ApiOkResponse({
    description: "Counselor profile updated successfully",
  })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateCounselorProfileDto,
  ): Promise<{ message: string }> {
    await this.updateCounselorProfileCommand.execute(user.id, dto);
    return { message: "Counselor profile updated successfully" };
  }
}

