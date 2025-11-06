import { Injectable, Logger } from '@nestjs/common';
import { BookSessionUseCase } from '@application/use-cases/booking/book-session.use-case';
import { SessionService } from '@domains/services/session/session.service';
import { ContractService } from '@domains/contract/contract.service';
import { BookSessionRequestDto } from './dto/book-session-request.dto';
import { SessionDetailResponseDto } from './dto/session-detail-response.dto';
import { addDays, isBefore } from 'date-fns';

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
    return this.transformToResponseDto(result, session, balance, dto);
  }

  /**
   * 将业务数据转换为前端响应DTO
   * 这是BFF层的核心职责：添加前端特定的格式和提示
   */
  private transformToResponseDto(
    useCaseResult: any,
    session: any,
    balance: any,
    requestDto: BookSessionRequestDto,
  ): SessionDetailResponseDto {
    const scheduledAt = new Date(requestDto.scheduledStartTime);
    const cancelDeadline = addDays(scheduledAt, -1); // 提前24小时

    return {
      bookingId: useCaseResult.sessionId,
      scheduledAt: scheduledAt,
      duration: requestDto.duration,
      status: useCaseResult.status,
      statusText: this.translateStatus(useCaseResult.status),

      // 导师信息（简化版：实际应从Profile服务获取）
      mentor: {
        id: requestDto.mentorId,
        name: `Mentor ${requestDto.mentorId.substring(0, 8)}`, // TODO: 从Profile服务获取真实姓名
        avatar: undefined,
        company: undefined,
        position: undefined,
      },

      // 学生信息（简化版）
      student: {
        id: requestDto.studentId,
        name: `Student ${requestDto.studentId.substring(0, 8)}`, // TODO: 从Profile服务获取真实姓名
      },

      // 服务信息（简化版）
      service: {
        id: requestDto.serviceId,
        name: '1对1辅导', // TODO: 从Service服务获取真实名称
        type: 'session',
      },

      // 定价信息
      pricing: {
        cost: 0, // TODO: 从费率计算
        currency: 'USD',
        remainingBalance: balance.available,
      },

      // 会议信息
      meeting: useCaseResult.meetingUrl
        ? {
            url: useCaseResult.meetingUrl,
            password: useCaseResult.meetingPassword,
            provider: useCaseResult.meetingProvider || 'zoom',
          }
        : undefined,

      // 可用操作
      actions: {
        canCancel: isBefore(new Date(), cancelDeadline),
        cancelDeadline: cancelDeadline,
      },

      // 前端提示信息
      hints: this.generateHints(scheduledAt, balance),
    };
  }

  /**
   * 翻译状态为中文
   */
  private translateStatus(status: string): string {
    const statusMap: Record<string, string> = {
      scheduled: '已预约',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
    };
    return statusMap[status] || status;
  }

  /**
   * 生成前端提示信息
   * 这是BFF层为前端定制的内容
   */
  private generateHints(scheduledAt: Date, balance: any): string[] {
    const hints: string[] = [];

    // 预约成功提示
    hints.push('✅ 预约已确认');

    // 会议准备提示
    hints.push('💡 请提前5分钟准备会议链接和设备');

    // 取消政策提示
    const cancelDeadline = addDays(scheduledAt, -1);
    if (isBefore(new Date(), cancelDeadline)) {
      hints.push(`⚠️ 如需取消，请在 ${cancelDeadline.toLocaleString('zh-CN')} 前操作`);
    } else {
      hints.push('⚠️ 已超过取消期限，无法取消此预约');
    }

    // 余额提示
    if (balance.available <= 2) {
      hints.push(`📢 学生剩余课时不足（剩余 ${balance.available} 次），请提醒充值`);
    }

    return hints;
  }
}
