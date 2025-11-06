import { Injectable, Logger } from '@nestjs/common';
import { BookSessionUseCase } from '@application/use-cases/booking/book-session.use-case';
import { SessionService } from '@domains/services/session/services/session.service';
import { ContractService } from '@domains/contract/contract.service';
import { BookSessionRequestDto } from './dto/book-session-request.dto';
import { SessionDetailResponseDto } from './dto/session-detail-response.dto';

/**
 * Operations Layer - Counselor Sessions Service (BFF)
 * 职责：为顾问端提供会话管理的前端适配服务
 *
 * 参考 application_bff_both_need.md 5.2 节
 * BFF层职责：
 * 1. 调用 Application 层的 UseCase
 * 2. Entity → Response DTO 转换
 * 3. 添加前端特定的提示信息和操作
 */
@Injectable()
export class CounselorSessionsService {
  private readonly logger = new Logger(CounselorSessionsService.name);

  constructor(
    private readonly bookSessionUseCase: BookSessionUseCase,
    private readonly sessionService: SessionService,
    private readonly contractService: ContractService,
  ) {}

  /**
   * 预约会话
   * @param counselorId 顾问ID（来自JWT token）
   * @param dto 预约请求DTO
   * @returns 会话详情响应（包含丰富的前端展示数据）
   */
  async bookSession(
    counselorId: string,
    dto: BookSessionRequestDto,
  ): Promise<SessionDetailResponseDto> {
    this.logger.log(`顾问 ${counselorId} 为学生 ${dto.studentId} 预约会话`);

    // 1. 调用 Application 层 UseCase（事务处理）
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

    // 2. 获取额外数据用于前端展示（并行查询优化）
    const [session, balance] = await Promise.all([
      this.sessionService.getSessionById(result.sessionId),
      this.contractService.getServiceBalance(dto.contractId, dto.serviceId),
    ]);

    // 3. 转换为前端响应格式
    return {
      bookingId: result.sessionId,
      scheduledAt: new Date(dto.scheduledStartTime),
      duration: dto.duration,
      status: result.status,
      statusText: '已预约',
      mentor: { id: dto.mentorId, name: 'Mentor Name' },
      student: { id: dto.studentId, name: 'Student Name' },
      service: { id: dto.serviceId, name: '1对1辅导', type: 'session' },
      pricing: { cost: 0, currency: 'USD', remainingBalance: balance.available },
      meeting: result.meetingUrl ? {
        url: result.meetingUrl,
        password: result.meetingPassword,
        provider: result.meetingProvider || 'zoom',
      } : undefined,
      actions: { canCancel: true, cancelDeadline: new Date() },
      hints: ['✅ 预约已确认'],
    };
  }
}
