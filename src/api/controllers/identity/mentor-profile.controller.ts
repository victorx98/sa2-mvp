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
import { UpdateMentorProfileInput } from "@application/commands/profile/dto/update-mentor-profile.input";
import { MentorProfileUseCase } from "@application/queries/identity/use-cases/mentor-profile.use-case";

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
@Controller(`${ApiPrefix}/mentors/profile`)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("mentor")
@ApiBearerAuth()
export class MentorProfileController {
  constructor(
    private readonly updateMentorProfileCommand: UpdateMentorProfileCommand,
    private readonly mentorProfileQuery: MentorProfileUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get mentor profile" })
  @ApiOkResponse({
    description: "Mentor profile retrieved successfully",
  })
  async getProfile(@CurrentUser() user: User) {
    return this.mentorProfileQuery.getMentorProfile(user.id);
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
    // ✅ 将 API DTO 映射为 UseCase Input
    const input: UpdateMentorProfileInput = {
      nameEn: dto.nameEn,
      nameZh: dto.nameZh,
      gender: dto.gender,
      country: dto.country,
      status: dto.status,
      type: dto.type,
      company: dto.company,
      companyTitle: dto.companyTitle,
      briefIntro: dto.briefIntro,
      highSchool: dto.highSchool,
      location: dto.location,
      level: dto.level,
      rating: dto.rating,
      underCollege: dto.underCollege,
      underMajor: dto.underMajor,
      graduateCollege: dto.graduateCollege,
      graduateMajor: dto.graduateMajor,
    };
    await this.updateMentorProfileCommand.execute(user.id, input);
    return { message: "Mentor profile updated successfully" };
  }
}

