import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";
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
 * API Layer - Counselor Students Controller
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
@ApiTags("Counselor Portal")
@Controller(`${ApiPrefix}/counselor`)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('counselor')
export class CounselorStudentsController {
  constructor(
    // ✅ 直接注入 Application Layer 服务
    private readonly studentListQuery: StudentListQuery,
  ) {}

  @Get("student/list")
  @ApiOperation({ summary: "Get student list for counselor" })
  @ApiOkResponse({
    description: "Student list retrieved successfully",
    type: StudentSummaryResponseDto,
    isArray: true,
  })
  async getStudentList(
    @CurrentUser() user: User,
    @Query("search") search?: string,
  ): Promise<StudentSummaryResponseDto[]> {
    const items = await this.studentListQuery.findByCounselorId(
      user.id,
      search,
    );
    return plainToInstance(StudentSummaryResponseDto, items, {
      enableImplicitConversion: false,
    });
  }
}
