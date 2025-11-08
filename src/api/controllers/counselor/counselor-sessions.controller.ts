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
    summary: "Counselor books a session for a student",
    description: `
      Counselors book a one-on-one coaching session for their assigned students.

      Flow:
      1. Validate counselor permissions
      2. Check student service balance
      3. Verify mentor availability
      4. Create the session booking
      5. Reserve the calendar slot
      6. Create the meeting link
      7. Send notifications
    `,
  })
  @ApiResponse({
    status: 201,
    description: "Booking created successfully",
    type: SessionDetailResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request parameters or insufficient balance",
  })
  @ApiResponse({
    status: 403,
    description: "Not authorized to book for this student",
  })
  @ApiResponse({
    status: 409,
    description: "Timeslot conflict (mentor already scheduled)",
  })
  async bookSession(
    @CurrentUser() user: User,
    @Body() dto: BookSessionRequestDto,
  ): Promise<SessionDetailResponseDto> {
    return await this.sessionsService.bookSession(user.id, dto);
  }
}
