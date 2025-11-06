import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SessionBffService } from '@operations/common-portal/session/session.service';
import { BookSessionDto } from '@operations/common-portal/session/dto/book-session.dto';
import { SessionResponseDto } from '@operations/common-portal/session/dto/session-response.dto';

/**
 * API Layer - Session Controller
 * 职责：提供会话相关的 HTTP 接口
 * 特点：薄控制器，只负责路由和参数验证，业务逻辑委托给 BFF Service
 */
@ApiTags('Sessions')
@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionBffService: SessionBffService) {}

  /**
   * 预约课程
   * POST /sessions/book
   */
  @Post('book')
  @ApiOperation({ summary: '预约课程' })
  @ApiResponse({
    status: 201,
    description: '预约成功',
    type: SessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: '请求参数错误或服务余额不足',
  })
  @ApiResponse({
    status: 409,
    description: '时间冲突，该时间段不可用',
  })
  async bookSession(@Body() bookSessionDto: BookSessionDto): Promise<SessionResponseDto> {
    return this.sessionBffService.bookSession(bookSessionDto);
  }
}
