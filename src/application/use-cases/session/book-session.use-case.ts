import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { ContractService } from '@domains/contract/contract.service';
import { CalendarService } from '../../../core/calendar/calendar.service';
import { SessionService } from '@domains/services/session/session.service';
import { MeetingProviderService } from '../../../core/meeting-providers/meeting-provider.service';

/**
 * Application Layer - Book Session UseCase
 * 职责：协调约课流程的业务逻辑
 *
 * 流程（参考 application_bff_both_need.md 5.2）：
 * 1. 检查合同服务余额
 * 2. 检查时间槽可用性
 * 3. 创建日历占用
 * 4. 创建会话记录
 * 5. 创建服务预占
 * 6. 创建会议链接
 */
@Injectable()
export class BookSessionUseCase {
  constructor(
    private readonly contractService: ContractService,
    private readonly calendarService: CalendarService,
    private readonly sessionService: SessionService,
    private readonly meetingProviderService: MeetingProviderService,
  ) {}

  async execute(data: {
    studentId: string;
    contractId: string;
    mentorId: string;
    startTime: Date;
    duration: number; // 分钟
    name: string;
    serviceId?: string; // 可选：如果不传则使用默认服务
    provider?: string; // 可选：会议服务提供商，默认 'zoom'
  }): Promise<{
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
  }> {
    const { studentId, contractId, mentorId, startTime, duration, name } = data;
    const serviceId = data.serviceId || 'default_service'; // TODO: 从合同获取默认服务
    const provider = data.provider || 'zoom';

    // 计算结束时间
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    // Step 1: 检查合同服务余额
    const balance = await this.contractService.getServiceBalance(contractId, serviceId);
    if (balance.available < 1) {
      throw new BadRequestException('服务余额不足，无法预约课程');
    }

    // Step 2: 检查导师时间槽可用性
    const isAvailable = await this.calendarService.isSlotAvailable(
      'mentor',
      mentorId,
      startTime,
      duration,
    );
    if (!isAvailable) {
      throw new ConflictException('该时间段导师不可用，请选择其他时间');
    }

    // Step 3: 创建日历占用时间槽
    const calendarSlot = await this.calendarService.createOccupiedSlot({
      resourceType: 'mentor',
      resourceId: mentorId,
      startTime,
      endTime,
      status: 'occupied',
    });

    try {
      // Step 4: 创建会议链接（先创建，这样 session 可以保存 meetingUrl）
      const meeting = await this.meetingProviderService.createMeeting({
        provider,
        topic: name,
        startTime,
        duration,
        hostId: mentorId,
        attendees: [
          {
            email: `student_${studentId}@example.com`, // TODO: 从用户服务获取真实邮箱
            name: `Student ${studentId}`,
          },
        ],
      });

      // Step 5: 创建会话记录
      const session = await this.sessionService.createSession({
        studentId,
        mentorId,
        contractId,
        serviceId,
        startTime,
        endTime,
        duration,
        name,
        meetingUrl: meeting.joinUrl,
        calendarSlotId: calendarSlot.id,
      });

      // Step 6: 创建服务预占（有效期到课程结束后1小时）
      const holdUntil = new Date(endTime.getTime() + 60 * 60 * 1000);
      const serviceHold = await this.contractService.createServiceHold({
        contractId,
        serviceId,
        quantity: 1,
        holdUntil,
        sessionId: session.id,
      });

      // 返回完整的预约信息
      return {
        sessionId: session.id,
        studentId: session.studentId,
        mentorId: session.mentorId,
        contractId: session.contractId,
        serviceId: session.serviceId,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        name: session.name,
        status: session.status,
        meetingUrl: session.meetingUrl || meeting.joinUrl,
        calendarSlotId: calendarSlot.id,
        serviceHoldId: serviceHold.id,
      };
    } catch (error) {
      // 如果后续步骤失败，需要回滚日历占用
      await this.calendarService.releaseSlot(calendarSlot.id);
      throw error;
    }
  }
}
