import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { User } from "@domains/identity/user/user.interface";
import { CounselorSessionsService } from "@operations/counselor-portal/sessions/sessions.service";
import { BookSessionRequestDto } from "@operations/counselor-portal/sessions/dto/book-session-request.dto";
import { SessionDetailResponseDto } from "@operations/counselor-portal/sessions/dto/session-detail-response.dto";

/**
 * API Layer - Counselor Sessions Controller
 * 路由：/api/counselor/sessions
 *
 * 职责：
 * 1. 定义HTTP路由
 * 2. 参数提取和验证
 * 3. 调用BFF层服务
 * 4. 返回HTTP响应
 */
@ApiTags("Counselor Portal - Sessions")
@Controller("api/counselor/sessions")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CounselorSessionsController {
  constructor(private readonly sessionsService: CounselorSessionsService) {}

  /**
   * 预约会话
   * POST /api/counselor/sessions
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "顾问为学生预约会话",
    description: `
      顾问为其负责的学生预约一对一辅导会话。

      流程：
      1. 验证顾问权限
      2. 检查学生服务余额
      3. 检查导师时间可用性
      4. 创建会话预约
      5. 占用日历时段
      6. 创建会议链接
      7. 发送通知
    `,
  })
  @ApiResponse({
    status: 201,
    description: "预约成功",
    type: SessionDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "请求参数错误或余额不足",
  })
  @ApiResponse({
    status: 403,
    description: "无权限为该学生预约（不是该学生的顾问）",
  })
  @ApiResponse({
    status: 409,
    description: "时间冲突（导师该时段已有安排）",
  })
  async bookSession(
    @CurrentUser() user: User,
    @Body() dto: BookSessionRequestDto,
  ): Promise<SessionDetailResponseDto> {
    return await this.sessionsService.bookSession(user.id, dto);
  }
}
