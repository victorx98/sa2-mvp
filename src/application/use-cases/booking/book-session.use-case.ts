import { Inject, Injectable, Logger } from '@nestjs/common';
import { ContractService } from '@domains/contract/contract.service';
import { SessionService } from '@domains/services/session/session.service';
import { CalendarService } from '@core/calendar/calendar.service';
import { MeetingProviderService } from '@core/meeting-providers/meeting-provider.service';
import { BookSessionInput } from './dto/book-session-input.dto';
import { BookSessionOutput } from './dto/book-session-output.dto';
import {
  UnauthorizedException,
  InsufficientBalanceException,
  TimeConflictException,
} from '@shared/exceptions';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

/**
 * Application Layer - Book Session Use Case
 * 职责：编排顾问为学生预约会话的完整流程
 *
 * 流程（参考 application_bff_both_need.md 5.2）：
 * 1. 检查顾问权限（暂时跳过，后续添加 CounselorAssignmentService）
 * 2. 检查服务余额
 * 3. 检查时间冲突
 * 4. 创建服务预占
 * 5. 创建会议链接
 * 6. 创建会话记录（包含会议信息）
 * 7. 占用日历时段
 *
 * 注意：步骤2-7在数据库事务中执行，任何步骤失败都会自动回滚
 * 包括会议创建失败也会触发回滚，确保数据一致性
 */
@Injectable()
export class BookSessionUseCase {
  private readonly logger = new Logger(BookSessionUseCase.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase,
    private readonly contractService: ContractService,
    private readonly sessionService: SessionService,
    private readonly calendarService: CalendarService,
    private readonly meetingProviderService: MeetingProviderService,
  ) {}

  /**
   * 执行预约会话用例
   * @param input 预约输入参数
   * @returns 预约结果
   */
  async execute(input: BookSessionInput): Promise<BookSessionOutput> {
    this.logger.log(`开始预约会话: studentId=${input.studentId}, mentorId=${input.mentorId}`);

    // Step 1: 检查顾问权限（事务外）
    // TODO: 实现 CounselorAssignmentService 后添加
    // const isAuthorized = await this.counselorAssignmentService.validateAssignment(
    //   input.counselorId,
    //   input.studentId,
    // );
    // if (!isAuthorized) {
    //   throw new UnauthorizedException('您不是该学生的顾问');
    // }

    // Step 2-7: 在事务中执行（包括创建会议链接）
    let sessionResult;
    try {
      sessionResult = await this.db.transaction(async (tx) => {
        this.logger.debug('开始数据库事务，包括会议创建在内的所有操作');

        // Step 2: 检查余额
        const balance = await this.contractService.getServiceBalance(
          input.contractId,
          input.serviceId,
        );

        if (balance.available < 1) {
          this.logger.warn(`余额不足: contractId=${input.contractId}, available=${balance.available}`);
          throw new InsufficientBalanceException(
            `学生服务余额不足，当前可用: ${balance.available} 次`,
          );
        }

        // Step 3: 检查时间冲突
        const isAvailable = await this.calendarService.isSlotAvailable(
          'mentor',
          input.mentorId,
          input.scheduledStartTime,
          input.duration,
        );

        if (!isAvailable) {
          this.logger.warn(`时间冲突: mentorId=${input.mentorId}, startTime=${input.scheduledStartTime}`);
          throw new TimeConflictException('导师在该时段已有安排');
        }

        // Step 4: 创建服务预占
        const hold = await this.contractService.createServiceHold({
          contractId: input.contractId,
          serviceId: input.serviceId,
          quantity: 1,
          holdUntil: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后过期
        });

        this.logger.debug(`创建服务预占成功: holdId=${hold.id}`);

        // Step 5: 创建会议链接（在创建session之前）
        let meetingInfo: {
          meetingUrl?: string;
          password?: string;
          provider?: string;
        } = {};

        try {
          const meeting = await this.meetingProviderService.createMeeting({
            provider: input.meetingProvider || 'zoom',
            topic: input.topic,
            startTime: input.scheduledStartTime,
            duration: input.duration,
            hostId: input.mentorId,
          });

          meetingInfo = {
            meetingUrl: meeting.joinUrl,
            password: meeting.password,
            provider: meeting.provider,
          };

          this.logger.debug(`创建会议成功: meetingId=${meeting.meetingId}`);
        } catch (error) {
          // 会议创建失败，回滚整个事务
          this.logger.error(`创建会议失败，事务将回滚: ${error.message}`, error.stack);
          throw error; // 抛出异常触发事务回滚
        }

        // Step 6: 创建会话记录（包含会议URL）
        const session = await this.sessionService.createSession({
          studentId: input.studentId,
          mentorId: input.mentorId,
          contractId: input.contractId,
          serviceId: input.serviceId,
          startTime: input.scheduledStartTime,
          endTime: input.scheduledEndTime,
          duration: input.duration,
          name: input.topic,
          serviceHoldId: hold.id,
          meetingUrl: meetingInfo.meetingUrl, // 会议链接
        });

        this.logger.debug(`创建会话成功: sessionId=${session.id}`);

        // Step 7: 占用日历时段
        const calendarSlot = await this.calendarService.createOccupiedSlot({
          resourceType: 'mentor',
          resourceId: input.mentorId,
          startTime: input.scheduledStartTime,
          endTime: input.scheduledEndTime,
          sessionId: session.id,
          status: 'occupied',
        });

        this.logger.debug(`占用日历时段成功: slotId=${calendarSlot.id}`)

        // 事务提交前返回结果
        return {
          session,
          hold,
          calendarSlot,
          meetingInfo,
        };
      });

      this.logger.log(`事务提交成功: sessionId=${sessionResult.session.id}`);
    } catch (error) {
      this.logger.error(`事务回滚: ${error.message}`, error.stack);
      throw error; // 重新抛出异常，让上层处理
    }

    // 返回预约结果
    return {
      sessionId: sessionResult.session.id,
      studentId: sessionResult.session.studentId,
      mentorId: sessionResult.session.mentorId,
      contractId: sessionResult.session.contractId,
      serviceId: sessionResult.session.serviceId,
      scheduledStartTime: sessionResult.session.startTime,
      scheduledEndTime: sessionResult.session.endTime,
      duration: sessionResult.session.duration,
      status: sessionResult.session.status,
      calendarSlotId: sessionResult.calendarSlot.id,
      serviceHoldId: sessionResult.hold.id,
      meetingUrl: sessionResult.meetingInfo.meetingUrl,
      meetingPassword: sessionResult.meetingInfo.password,
      meetingProvider: sessionResult.meetingInfo.provider,
    };
  }
}
