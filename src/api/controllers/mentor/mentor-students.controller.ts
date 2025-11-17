import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { StudentListQuery } from "@application/queries/student/student-list.query";
import { StudentListItem } from "@domains/query/services/student-query.service";
import { User } from "@domains/identity/user/user-interface";

/**
 * API Layer - Mentor Students Controller
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
@ApiTags("Mentor Portal")
@Controller("api/mentor")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("mentor")
export class MentorStudentsController {
  constructor(
    // ✅ 直接注入 Application Layer 服务
    private readonly studentListQuery: StudentListQuery,
  ) {}

  @Get("student/list")
  @ApiOperation({ summary: "Get student list for mentor" })
  @ApiResponse({
    status: 200,
    description: "Student list retrieved successfully",
    type: Array,
  })
  async getStudentList(
    @CurrentUser() user: User,
  ): Promise<StudentListItem[]> {
    // ✅ 直接调用 Application Layer 服务
    return this.studentListQuery.findByMentorId(user.id);
  }
}
