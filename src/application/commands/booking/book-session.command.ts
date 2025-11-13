import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
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
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";
import { BookSessionInput } from "./dto/book-session-input.dto";
import { BookSessionOutput } from "./dto/book-session-output.dto";
import { TimeConflictException } from "@shared/exceptions";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type {
  DrizzleDatabase,
  DrizzleTransaction,
} from "@shared/types/database.types";
import {
  SessionBookedEvent,
  SESSION_BOOKED_EVENT,
} from "@shared/events/session-booked.event";

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
    private readonly sessionService: SessionService,
    private readonly calendarService: CalendarService,
    private readonly meetingProviderFactory: MeetingProviderFactory,
    private readonly eventEmitter: EventEmitter2,
    private readonly serviceHoldService: ServiceHoldService,
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

        // Step 2: 创建服务预占
        // const hold = await this.serviceHoldService.createHold({
        //   studentId: input.studentId,
        //   serviceType: input.serviceType,
        //   quantity: 1,
        //   createdBy: input.counselorId,
        // }, tx);


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

        // Step 5: 创建会议链接（在事务内，先创建）
        let meetingInfo: {
          meetingUrl?: string;
          password?: string;
          provider?: string;
          meetingNo?: string;
        } = {};
        try {
          meetingInfo = await this.meetingProviderFactory
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
            meetingUrl: meetingInfo.meetingUrl,
            meetingPassword: meetingInfo.password,
            meetingNo: meetingInfo.meetingNo,
          },
          tx,
        );

        return {
          session,
          // hold,
          calendarSlot,
          meetingInfo,
        };
      });
    } catch (error) {
      this.logger.error(`Book session transaction rollback: ${error.message}`, error.stack);
      throw error;
    }

    const bookResult: SessionBookedEvent = {
      sessionId: sessionResult.session.id,
      studentId: input.studentId,
      mentorId: input.mentorId,
      counselorId: input.counselorId,
      serviceType: input.serviceType,
      calendarSlotId: sessionResult.calendarSlot.id,
      // serviceHoldId: sessionResult.hold.id,
      serviceHoldId: null,
      scheduledStartTime: input.scheduledStartTime.toISOString(),
      scheduledEndTime: input.scheduledEndTime.toISOString(),
      duration: input.duration,
      meetingUrl: sessionResult.meetingInfo.meetingUrl,
      meetingProvider: sessionResult.meetingInfo.provider,
      meetingPassword: sessionResult.meetingInfo.password,
    };

    this.logger.debug(
      `Emitting session booked event for session ${sessionResult.session.id}`,
    );
    this.eventEmitter.emit(SESSION_BOOKED_EVENT, bookResult);
    return {
      ...bookResult,
      status: sessionResult.session.status,
    };
  }
}
