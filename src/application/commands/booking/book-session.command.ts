import { Inject, Injectable, Logger } from "@nestjs/common";
import { CalendarService } from "@core/calendar";
import {
  UserType,
  SlotType,
} from "@core/calendar/interfaces/calendar-slot.interface";
import {
  MeetingProviderFactory,
  MeetingProviderType,
} from "@core/meeting-providers";
import type { MeetingProvider } from "@domains/services/session/interfaces/session.interface";
import { SessionService } from "@domains/services/session/services/session.service";
import { ContractService } from "@domains/contract/contract.service";
import { BookSessionInput } from "./dto/book-session-input.dto";
import { BookSessionOutput } from "./dto/book-session-output.dto";
import { InsufficientBalanceException, TimeConflictException } from "@shared/exceptions";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type {
  DrizzleDatabase,
  DrizzleTransaction,
} from "@shared/types/database.types";

/**
 * Application Layer - Book Session Command
 * 职责：编排顾问为学生预约会话的完整流程
 *
 * 流程（参考 application_bff_both_need.md 5.2）：
 * 1. 检查顾问权限（TODO: 实现 CounselorAssignmentService）
 * 2. 检查服务余额
 * 3. 检查时间冲突
 * 4. 创建服务预占
 * 5. 创建会议链接
 * 6. 创建会话记录
 * 7. 占用日历时段
 *
 * 注意：步骤2-7在数据库事务中执行，任何步骤失败都会自动回滚
 * 包括会议创建失败也会触发回滚，确保数据一致性
 */
@Injectable()
export class BookSessionCommand {
  private readonly logger = new Logger(BookSessionCommand.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly contractService: ContractService,
    private readonly sessionService: SessionService,
    private readonly calendarService: CalendarService,
    private readonly meetingProviderFactory: MeetingProviderFactory,
  ) {}

  /**
   * 执行预约会话用例
   * @param input 预约输入参数
   * @returns 预约结果
   */
  async execute(input: BookSessionInput): Promise<BookSessionOutput> {
    this.logger.log(
      `开始预约会话: studentId=${input.studentId}, mentorId=${input.mentorId}`,
    );

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
      sessionResult = await this.db.transaction(async (tx: DrizzleTransaction) => {
        this.logger.debug(
          "Starting database transaction, including meeting creation",
        );

        // Step 2: 检查余额
        const balance = await this.contractService.getServiceBalance(
          input.contractId,
          input.serviceId,
        );
        if (balance.available < 1) {
          throw new InsufficientBalanceException("Insufficient service balance");
        }

        // Step 3: Try to create calendar slot directly (atomic with DB constraint)
        // Let the database EXCLUDE constraint handle conflicts
        const calendarSlot = await this.calendarService.createSlotDirect(
          {
            userId: input.mentorId,
            userType: UserType.MENTOR,
            startTime: input.scheduledStartTime.toISOString(),
            durationMinutes: input.duration,
            slotType: SlotType.SESSION,
            sessionId: undefined, // Will be updated after session creation
          },
          tx,
        );
        
        if (!calendarSlot) {
          throw new TimeConflictException("The mentor already has a conflict");
        }

        // Step 4: 创建服务预占
        const hold = await this.contractService.createServiceHold(
          {
            contractId: input.contractId,
            serviceId: input.serviceId,
            sessionId: "temp_session_id", // 临时ID，稍后会更新
            quantity: 1,
          },
          tx,
        );

        // Step 5: 创建会议链接（在事务内，先创建）
        let meetingInfo: {
          meetingUrl?: string;
          password?: string;
          provider?: string;
        } = {};
        try {
          const meeting = await this.meetingProviderFactory
            .getProvider(
              (input.meetingProvider as MeetingProviderType) ||
                MeetingProviderType.FEISHU,
            )
            .createMeeting({
              topic: input.topic,
              startTime: input.scheduledStartTime,
              duration: input.duration,
              hostUserId: input.mentorId,
            });
          meetingInfo = {
            meetingUrl: meeting.meetingUrl,
            password: meeting.meetingPassword,
            provider: meeting.provider,
          };
        } catch (error) {
          // 会议创建失败，回滚整个事务
          this.logger.error(
            `Meeting creation failed, rolling back transaction: ${error.message}`,
          );
          throw error;
        }

        // Step 6: 创建会话记录（包含会议URL）
        const session = await this.sessionService.createSession(
          {
            studentId: input.studentId,
            mentorId: input.mentorId,
            contractId: input.contractId,
            scheduledStartTime: input.scheduledStartTime.toISOString(),
            scheduledDuration: input.duration,
            sessionName: input.topic,
            meetingProvider: input.meetingProvider as MeetingProvider,
          },
          tx,
        );
        console.warn('session.id = ', session.id);

        // Calendar slot is already created in Step 3, just update it with session ID
        const updatedCalendarSlot = await this.calendarService.updateSlotSessionId(
          calendarSlot.id,
          session.id,
        );

        return {
          session,
          hold,
          calendarSlot: updatedCalendarSlot,
          meetingInfo,
        };
      });
    } catch (error) {
      this.logger.error(`Book session transaction rollback: ${error.message}`, error.stack);
      throw error;
    }

    return {
      sessionId: sessionResult.session.id,
      studentId: input.studentId,
      mentorId: input.mentorId,
      contractId: input.contractId,
      serviceId: input.serviceId,
      scheduledStartTime: input.scheduledStartTime,
      scheduledEndTime: input.scheduledEndTime,
      duration: input.duration,
      status: sessionResult.session.status,
      meetingUrl: sessionResult.meetingInfo.meetingUrl,
      meetingPassword: sessionResult.meetingInfo.password,
      meetingProvider: sessionResult.meetingInfo.provider,
      calendarSlotId: sessionResult.calendarSlot.id,
      serviceHoldId: sessionResult.hold.id,
    };
  }
}
