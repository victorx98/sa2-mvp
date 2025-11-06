import { Injectable, Logger } from '@nestjs/common';
import { BookSessionUseCase } from '@application/use-cases/booking/book-session.use-case';
import { BookSessionRequestDto } from './dto/book-session-request.dto';
import { SessionDetailResponseDto } from './dto/session-detail-response.dto';

/**
 * Operations Layer - Counselor Sessions Service (BFF)
 * 职责：为顾问端提供会话管理的前端适配服务
 *
 * 功能：
 * 1. 调用 Application 层的 UseCase
 * 2. Entity → Response DTO 转换（简化版：只返回sessionId和meeting信息）
 */
@Injectable()
export class CounselorSessionsService {
  private readonly logger = new Logger(CounselorSessionsService.name);

  constructor(
    private readonly bookSessionUseCase: BookSessionUseCase,
  ) {}

  /**
   * 预约会话
   * @param counselorId 顾问ID（来自JWT token）
   * @param dto 预约请求DTO
   * @returns 会话详情响应（只包含sessionId和meeting信息）
   */
  async bookSession(
    counselorId: string,
    dto: BookSessionRequestDto,
  ): Promise<SessionDetailResponseDto> {
    this.logger.log(`顾问 ${counselorId} 为学生 ${dto.studentId} 预约会话`);

    // 调用 Application 层 UseCase
    const result = await this.bookSessionUseCase.execute({
      counselorId,
      studentId: dto.studentId,
      mentorId: dto.mentorId,
      contractId: dto.contractId,
      serviceId: dto.serviceId,
      scheduledStartTime: new Date(dto.scheduledStartTime),
      scheduledEndTime: new Date(dto.scheduledEndTime),
      duration: dto.duration,
      topic: dto.topic,
      meetingProvider: dto.meetingProvider,
    });

    // 转换为前端响应格式（只返回sessionId和meeting信息）
    return {
      sessionId: result.sessionId,
      meeting: {
        url: result.meetingUrl,
        password: result.meetingPassword,
        provider: result.meetingProvider,
      },
    };
  }

}
