import { Injectable, Logger } from "@nestjs/common";
import { BookSessionCommand } from "@application/commands/booking/book-session.command";
import { SessionService } from "@domains/services/session/services/session.service";
import { ContractService } from "@domains/contract/services/contract.service";
import { BookSessionRequestDto } from "./dto/book-session-request.dto";
import { SessionDetailResponseDto } from "./dto/session-detail-response.dto";

/**
 * Operations Layer - Counselor Sessions Service (BFF)
 * 职责：为顾问端提供会话管理的前端适配服务
 *
 * 参考 application_bff_both_need.md 5.2 节
 * BFF层职责：
 * 1. 调用 Application 层的 Command
 * 2. Entity → Response DTO 转换
 * 3. 添加前端特定的提示信息和操作
 */
@Injectable()
export class CounselorSessionsService {
  private readonly logger = new Logger(CounselorSessionsService.name);

  constructor(
    private readonly bookSessionCommand: BookSessionCommand,
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
    this.logger.log(
      `Counselor ${counselorId} is booking a session for student ${dto.studentId}`,
    );

    // 1. 调用 Application 层 Command（事务处理）
    const result = await this.bookSessionCommand.execute({
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

    // 2. 转换为前端响应格式
    return {
      bookingId: result.sessionId,
      status: result.status,
      meeting: result.meetingUrl
        ? {
            url: result.meetingUrl,
            password: result.meetingPassword,
            provider: result.meetingProvider || "zoom",
          }
        : undefined,
    };
  }
}
