import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { StudentListQuery } from "@application/queries/student/student-list.query";
import { User } from "@domains/identity/user/user-interface";
import { ApiPrefix } from "@api/api.constants";
import { StudentSummaryResponseDto, StudentCounselorViewResponseDto, PaginatedStudentCounselorViewResponseDto } from "@api/dto/response/student-response.dto";
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

  @Get('find')
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

  @Get("listOfCounselorView")
  @Roles("counselor")
  @ApiOperation({ summary: "Get paginated student list for counselor view with school and major names" })
  @ApiQuery({
    name: "text",
    required: false,
    description: "Search keyword (searches in both Chinese and English names)",
    type: String,
  })
  @ApiQuery({
    name: "studentId",
    required: false,
    description: "Filter by specific student ID",
    type: String,
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Page number (starting from 1)",
    type: Number,
    example: 1,
  })
  @ApiQuery({
    name: "pageSize",
    required: false,
    description: "Number of items per page (max 100)",
    type: Number,
    example: 20,
  })
  @ApiQuery({
    name: "createdStart",
    required: false,
    description: "Filter by creation time start (ISO 8601 date string)",
    type: String,
    example: "2024-01-01T00:00:00Z",
  })
  @ApiQuery({
    name: "createdEnd",
    required: false,
    description: "Filter by creation time end (ISO 8601 date string)",
    type: String,
    example: "2024-12-31T23:59:59Z",
  })
  @ApiOkResponse({
    description: "Paginated student list for counselor view retrieved successfully",
    type: PaginatedStudentCounselorViewResponseDto,
  })
  async listOfCounselorView(
    @CurrentUser() user: User,
    @Query("text") text?: string,
    @Query("studentId") studentId?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("createdStart") createdStart?: string,
    @Query("createdEnd") createdEnd?: string,
  ): Promise<PaginatedStudentCounselorViewResponseDto> {
    // 解析分页参数，设置默认值和限制
    const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize || "20", 10) || 20));

    // ✅ 调用 Application Layer 服务，获取包含学校名称和专业名称的学生列表（带分页）
    const result = await this.studentListQuery.listOfCounselorView(
      user.id,
      text,
      pageNum,
      pageSizeNum,
      studentId,
      createdStart,
      createdEnd,
    );
    
    return {
      data: plainToInstance(StudentCounselorViewResponseDto, result.data, {
        enableImplicitConversion: false,
      }),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

}

