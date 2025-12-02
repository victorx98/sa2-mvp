import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { StudentListQuery } from "@application/queries/student/student-list.query";
import { User } from "@domains/identity/user/user-interface";
import { ApiPrefix } from "@api/api.constants";
import { StudentSummaryResponseDto } from "@api/dto/response/student-response.dto";
import { plainToInstance } from "class-transformer";

/**
 * API Layer - Students Controller
 * 职责：
 * 1. 定义学生相关的 HTTP 路由
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
@ApiTags("Students")
@Controller(`${ApiPrefix}/students`)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("mentor", "counselor", "student")
@ApiBearerAuth()
export class StudentsController {
  constructor(
    // ✅ 直接注入 Application Layer 服务
    private readonly studentListQuery: StudentListQuery,
  ) {}

  @Get("find")
  @Roles("mentor", "counselor")
  @ApiOperation({ summary: "find students" })
  @ApiQuery({
    name: "text",
    required: false,
    description: "Search keyword (searches in both Chinese and English names)",
    type: String,
  })
  @ApiOkResponse({
    description: "Student results retrieved successfully",
    type: StudentSummaryResponseDto,
    isArray: true,
  })
  async findStudents(
    @CurrentUser() user: User,
    @Query("text") text?: string,
  ): Promise<StudentSummaryResponseDto[]> {
    // ✅ 调用 Application Layer 服务，根据用户角色自动选择查询策略
    const items = await this.studentListQuery.find(user, text);
    return plainToInstance(StudentSummaryResponseDto, items, {
      enableImplicitConversion: false,
    });
  }

}

