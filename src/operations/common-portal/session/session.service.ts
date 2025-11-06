import { Injectable } from '@nestjs/common';
import { BookSessionUseCase } from '@application/use-cases/session/book-session.use-case';
import { SessionResponseDto } from './dto/session-response.dto';
import { BookSessionDto } from './dto/book-session.dto';

/**
 * BFF Layer - Session BFF Service
 * 职责：为前端提供会话相关的业务功能和数据转换
 *
 * 功能：
 * - 处理约课请求
 * - 转换会话数据为前端友好格式
 * - 添加前端需要的提示信息和操作按钮
 */
@Injectable()
export class SessionBffService {
  constructor(private readonly bookSessionUseCase: BookSessionUseCase) {}

  /**
   * 预约课程
   * @param bookSessionDto 预约数据
   * @returns 前端友好的预约结果
   */
  async bookSession(bookSessionDto: BookSessionDto): Promise<SessionResponseDto> {
    // 调用 Application Layer 的 UseCase
    const result = await this.bookSessionUseCase.execute({
      studentId: bookSessionDto.studentId,
      contractId: bookSessionDto.contractId,
      mentorId: bookSessionDto.mentorId,
      startTime: new Date(bookSessionDto.startTime),
      duration: bookSessionDto.duration,
      name: bookSessionDto.name,
      serviceId: bookSessionDto.serviceId,
      provider: bookSessionDto.provider || 'zoom',
    });

    // 转换为前端友好的格式
    return this.transformToResponse(result);
  }

  /**
   * 转换会话数据为前端响应格式
   * @param session 会话数据
   * @returns 前端响应 DTO
   */
  private transformToResponse(session: {
    sessionId: string;
    studentId: string;
    mentorId: string;
    contractId: string;
    serviceId: string;
    startTime: Date;
    endTime: Date;
    duration: number;
    name: string;
    status: string;
    meetingUrl: string;
    calendarSlotId: string;
    serviceHoldId: string;
  }): SessionResponseDto {
    return {
      sessionId: session.sessionId,
      name: session.name,
      mentorId: session.mentorId,
      studentId: session.studentId,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime.toISOString(),
      duration: session.duration,
      status: session.status,
      statusText: this.getStatusText(session.status),
      statusColor: this.getStatusColor(session.status),
      meetingUrl: session.meetingUrl,

      // 前端友好的提示信息
      message: '🎉 课程预约成功！',
      hints: [
        '📅 请准时参加课程',
        '🔗 会议链接已生成，可在开始前5分钟进入',
        '💡 如需取消或修改，请至少提前24小时操作',
      ],

      // 前端可用的操作按钮
      actions: [
        {
          label: '加入会议',
          action: 'join_meeting',
          icon: 'video',
          url: session.meetingUrl,
        },
        {
          label: '添加到日历',
          action: 'add_to_calendar',
          icon: 'calendar',
        },
        {
          label: '取消预约',
          action: 'cancel_session',
          icon: 'close',
        },
      ],
    };
  }

  /**
   * 获取状态显示文本
   */
  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      scheduled: '已预约',
      confirmed: '已确认',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
      no_show: '缺席',
    };
    return statusMap[status] || status;
  }

  /**
   * 获取状态颜色
   */
  private getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      scheduled: 'blue',
      confirmed: 'green',
      in_progress: 'orange',
      completed: 'gray',
      cancelled: 'red',
      no_show: 'red',
    };
    return colorMap[status] || 'gray';
  }
}
