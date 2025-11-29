import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { User } from "@domains/identity/user/user-interface";
import { ApiPrefix } from "@api/api.constants";
import { UpdateStudentProfileDto } from "@api/dto/request/update-student-profile.dto";
import { UpdateStudentProfileCommand } from "@application/commands/profile/update-student-profile.command";
import { StudentProfileQuery } from "@application/queries/student/student-profile.query";

/**
 * API Layer - Student Profile Controller
 * 职责：
 * 1. 定义学生档案的 HTTP 路由
 * 2. 提取请求参数
 * 3. 调用 Application Layer 服务
 * 4. 返回 HTTP 响应
 *
 * 设计原则：
 * ✅ 薄 Controller，只做路由
 * ✅ 直接注入 Application Layer 服务
 * ❌ 不包含业务逻辑
 */
@ApiTags("Student Profile")
@Controller(`${ApiPrefix}/student/profile`)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("student")
@ApiBearerAuth()
export class StudentProfileController {
  constructor(
    private readonly updateStudentProfileCommand: UpdateStudentProfileCommand,
    private readonly studentProfileQuery: StudentProfileQuery,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get student profile" })
  @ApiOkResponse({
    description: "Student profile retrieved successfully",
  })
  async getProfile(@CurrentUser() user: User) {
    return this.studentProfileQuery.getProfile(user.id);
  }

  @Put()
  @ApiOperation({ summary: "Update student profile" })
  @ApiBody({ type: UpdateStudentProfileDto })
  @ApiOkResponse({
    description: "Student profile updated successfully",
  })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateStudentProfileDto,
  ): Promise<{ message: string }> {
    await this.updateStudentProfileCommand.execute(user.id, dto);
    return { message: "Student profile updated successfully" };
  }
}


