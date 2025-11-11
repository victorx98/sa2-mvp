import { Injectable } from "@nestjs/common";
import { BookSessionCommand } from "@application/commands/booking/book-session.command";
import { SessionResponseDto } from "./dto/session-response.dto";
import { BookSessionDto } from "./dto/book-session.dto";

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
  constructor(private readonly bookSessionCommand: BookSessionCommand) {}

  /**
   * 预约课程
   * @param userId 用户ID（从JWT token获取，用作counselorId）
   * @param bookSessionDto 预约数据
   * @returns 前端友好的预约结果
   */
  async bookSession(
    userId: string,
    bookSessionDto: BookSessionDto,
  ): Promise<SessionResponseDto> {
    // 计算结束时间
    const startTime = new Date(bookSessionDto.startTime);
    const endTime = new Date(
      startTime.getTime() + bookSessionDto.duration * 60 * 1000,
    );

    // 调用 Application Layer 的 Command
    const result = await this.bookSessionCommand.execute({
      counselorId: userId, // 从JWT token获取
      studentId: bookSessionDto.studentId,
      contractId: bookSessionDto.contractId,
      mentorId: bookSessionDto.mentorId,
      serviceType: bookSessionDto.serviceType || "session",
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      duration: bookSessionDto.duration,
      topic: bookSessionDto.name,
      meetingProvider: bookSessionDto.provider || "zoom",
    });

    // 转换为前端友好的格式
    return this.transformToResponse(result);
  }

  /**
   * 转换会话数据为前端响应格式
   * @param result Command执行结果
   * @returns 前端响应 DTO
   */
  private transformToResponse(result: {
    sessionId: string;
    studentId: string;
    mentorId: string;
    serviceId: string;
    scheduledStartTime: string;
    scheduledEndTime: string;
    duration: number;
    status: string;
    meetingUrl?: string;
    meetingPassword?: string;
    meetingProvider?: string;
    calendarSlotId?: string;
    serviceHoldId?: string;
  }): SessionResponseDto {
    return {
      sessionId: result.sessionId,
      name: "Session", // TODO: 从result获取name
      mentorId: result.mentorId,
      studentId: result.studentId,
      startTime: result.scheduledStartTime,
      endTime: result.scheduledEndTime,
      duration: result.duration,
      status: result.status,
      statusText: this.getStatusText(result.status),
      statusColor: this.getStatusColor(result.status),
      meetingUrl: result.meetingUrl || "",

      // 前端友好的提示信息
      message: "🎉 Session booked successfully!",
      hints: [
        "📅 Please attend on time",
        result.meetingUrl
          ? "🔗 Meeting link is ready; you can join five minutes before start"
          : "⚠️ Meeting link creation failed, please contact the administrator",
        "💡 To cancel or reschedule, please do so at least 24 hours in advance",
      ],

      // 前端可用的操作按钮
      actions: result.meetingUrl
        ? [
            {
              label: "Join meeting",
              action: "join_meeting",
              icon: "video",
              url: result.meetingUrl,
            },
            {
              label: "Add to calendar",
              action: "add_to_calendar",
              icon: "calendar",
            },
            {
              label: "Cancel session",
              action: "cancel_session",
              icon: "close",
            },
          ]
        : [
            {
              label: "Add to calendar",
              action: "add_to_calendar",
              icon: "calendar",
            },
            {
              label: "Cancel session",
              action: "cancel_session",
              icon: "close",
            },
          ],
    };
  }

  /**
   * 获取状态显示文本
   */
  private getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      scheduled: "Scheduled",
      confirmed: "Confirmed",
      in_progress: "In progress",
      completed: "Completed",
      cancelled: "Cancelled",
      no_show: "No show",
    };
    return statusMap[status] || status;
  }

  /**
   * 获取状态颜色
   */
  private getStatusColor(status: string): string {
    const colorMap: Record<string, string> = {
      scheduled: "blue",
      confirmed: "green",
      in_progress: "orange",
      completed: "gray",
      cancelled: "red",
      no_show: "red",
    };
    return colorMap[status] || "gray";
  }
}
