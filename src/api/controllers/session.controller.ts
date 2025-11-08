import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { User } from "@domains/identity/user/user.interface";
import { SessionBffService } from "@operations/common-portal/session/session.service";
import { BookSessionDto } from "@operations/common-portal/session/dto/book-session.dto";
import { SessionResponseDto } from "@operations/common-portal/session/dto/session-response.dto";

/**
 * API Layer - Session Controller
 * 职责：提供会话相关的 HTTP 接口
 * 特点：薄控制器，只负责路由和参数验证，业务逻辑委托给 BFF Service
 */
@ApiTags("Sessions")
@Controller("sessions")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(private readonly sessionBffService: SessionBffService) {}

  /**
   * 预约课程
   * POST /sessions/book
   */
  @Post("book")
  @ApiOperation({ summary: "Book a session" })
  @ApiResponse({
    status: 201,
    description: "Booking created successfully",
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request parameters or insufficient balance",
  })
  @ApiResponse({
    status: 409,
    description: "Timeslot conflict; mentor unavailable",
  })
  async bookSession(
    @CurrentUser() user: User,
    @Body() bookSessionDto: BookSessionDto,
  ): Promise<SessionResponseDto> {
    return this.sessionBffService.bookSession(user.id, bookSessionDto);
  }
}
