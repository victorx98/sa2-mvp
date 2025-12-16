import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
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
import { ApiPrefix } from "@api/api.constants";
import { UpdateStudentProfileDto } from "@api/dto/request/update-student-profile.dto";
import { UpdateStudentProfileCommand } from "@application/commands/profile/update-student-profile.command";
import { UpdateStudentProfileInput } from "@application/commands/profile/dto/update-student-profile.input";
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
@Controller(`${ApiPrefix}/students/:studentId/profile`)
@UseGuards(JwtAuthGuard)
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
  async getProfile(@Param("studentId") studentId: string) {
    return this.studentProfileQuery.getProfile(studentId);
  }

  @Put()
  @ApiOperation({ summary: "Update student profile" })
  @ApiBody({ type: UpdateStudentProfileDto })
  @ApiOkResponse({
    description: "Student profile updated successfully",
  })
  async updateProfile(
    @Param("studentId") studentId: string,
    @Body() dto: UpdateStudentProfileDto,
  ): Promise<{ message: string }> {
    // ✅ 将 API DTO 映射为 UseCase Input
    const input: UpdateStudentProfileInput = {
      nameEn: dto.nameEn,
      nameZh: dto.nameZh,
      gender: dto.gender,
      country: dto.country,
      status: dto.status,
      highSchool: dto.highSchool,
      underCollege: dto.underCollege,
      underMajor: dto.underMajor,
      graduateCollege: dto.graduateCollege,
      graduateMajor: dto.graduateMajor,
      aiResumeSummary: dto.aiResumeSummary,
      customerImportance: dto.customerImportance,
      underGraduationDate: dto.underGraduationDate,
      graduateGraduationDate: dto.graduateGraduationDate,
      grades: dto.grades,
    };
    await this.updateStudentProfileCommand.execute(studentId, input);
    return { message: "Student profile updated successfully" };
  }
}


