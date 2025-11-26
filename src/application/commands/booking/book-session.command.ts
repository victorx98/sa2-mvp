import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { CalendarService } from "@core/calendar";
import {
  UserType,
  SessionType as CalendarSessionType,
} from "@core/calendar/interfaces/calendar-slot.interface";
import { MeetingManagerService } from "@core/meeting";
import { MeetingProviderType } from "@core/meeting";
import { RegularMentoringService } from "@domains/services/sessions/regular-mentoring/services/regular-mentoring.service";
import { SessionType } from "@domains/services/sessions/shared/enums/session-type.enum";
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";
import { BookSessionInput } from "./dto/book-session-input.dto";
import { BookSessionOutput } from "./dto/book-session-output.dto";
import { TimeConflictException } from "@shared/exceptions";
import { FEISHU_DEFAULT_HOST_USER_ID } from "src/constants";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type {
  DrizzleDatabase,
  DrizzleTransaction,
} from "@shared/types/database.types";
import {
  SessionBookedEvent,
  SESSION_BOOKED_EVENT,
} from "@shared/events/session-booked.event";
import { Trace, addSpanAttributes, addSpanEvent } from "@shared/decorators/trace.decorator";
import { MetricsService } from "@telemetry/metrics.service";

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
    private readonly meetingManagerService: MeetingManagerService,
    private readonly mentoringService: RegularMentoringService,
    private readonly calendarService: CalendarService,
    private readonly eventEmitter: EventEmitter2,
    private readonly serviceHoldService: ServiceHoldService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * 执行预约会话用例
   * @param input 预约输入参数
   * @returns 预约结果
   */
  @Trace({
    name: 'booking.session.execute',
    attributes: { 'operation.type': 'booking' },
  })
  async execute(input: BookSessionInput): Promise<BookSessionOutput> {
    const bookingStartTime = Date.now();

    this.logger.log(
      `开始预约会话: studentId=${input.studentId}, mentorId=${input.mentorId}`,
    );

    // Add attributes to the span
    addSpanAttributes({
      'student.id': input.studentId,
      'mentor.id': input.mentorId,
      'counselor.id': input.counselorId,
      'session.duration': input.duration,
      'meeting.provider': input.meetingProvider || 'feishu',
    });

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
      addSpanEvent('booking.transaction.start');

      sessionResult = await this.db.transaction(async (tx: DrizzleTransaction) => {
        this.logger.debug(
          "Starting database transaction, including meeting creation",
        );

        // Step 2: 创建服务预占
        if (!input.serviceType) {
          throw new Error("serviceType is required");
        }
        const hold = await this.serviceHoldService.createHold({
          studentId: input.studentId,
          serviceType: input.serviceType,
          quantity: 1,
          createdBy: input.counselorId,
        }, tx);


        // Step 3: Try to create calendar slot directly (atomic with DB constraint)
        // Let the database EXCLUDE constraint handle conflicts
        const [mentorCalendarSlot, studentCalendarSlot] = await Promise.all([
          this.calendarService.createSlotDirect({
            userId: input.mentorId,
            userType: UserType.MENTOR,
            startTime: input.scheduledStartTime,
            durationMinutes: input.duration,
            sessionType: CalendarSessionType.REGULAR_MENTORING,
            title: input.topic || "Regular Mentoring Session",
            sessionId: undefined, // Will be updated after session creation
            metadata: {
              otherPartyName: 'studentName', // TODO: should be fetched from student table
            },
          }, tx),
          this.calendarService.createSlotDirect({
            userId: input.studentId,
            userType: UserType.STUDENT,
            startTime: input.scheduledStartTime,
            durationMinutes: input.duration,
            sessionType: CalendarSessionType.REGULAR_MENTORING,
            title: input.topic || "Regular Mentoring Session",
            sessionId: undefined, // Will be updated after session creation
            metadata: {
              otherPartyName: 'mentorName', // TODO: should be fetched from mentor table
            },
          }, tx)
        ]);
        
        if (!mentorCalendarSlot) {
          throw new TimeConflictException("The mentor already has a conflict");
        } if (!studentCalendarSlot) {
          throw new TimeConflictException("The student already has a conflict");
        }

        // Step 5: 创建会议链接（在事务内，先创建）
        let meetingInfo;
        try {
          meetingInfo = await this.meetingManagerService.createMeeting({
            topic: input.topic,
            startTime: input.scheduledStartTime,
            duration: input.duration,
            provider: (input.meetingProvider as MeetingProviderType) || MeetingProviderType.FEISHU,
            hostUserId: FEISHU_DEFAULT_HOST_USER_ID,
            autoRecord: true,
            participantJoinEarly: true,
          }, tx);
        } catch (error) {
          // 会议创建失败，回滚整个事务
          this.logger.error(
            `Meeting creation failed, rolling back transaction: ${error.message}`,
          );
          throw error;
        }

        // Step 6: 创建会话记录（包含会议URL）
        const mentoringSession = await this.mentoringService.createSession({
          meetingId: meetingInfo.id,
          sessionType: SessionType.REGULAR_MENTORING,
          sessionTypeId: '11111111-1111-1111-1111-111111111111', // TODO: should be fetched from session_types table
          studentUserId: input.studentId,
          mentorUserId: input.mentorId,
          createdByCounselorId: input.counselorId,
          scheduledAt: input.scheduledStartTime,
          title: input.topic,
          description: null,
        }, tx);

        // Step 7: Update calendar slot with session ID, meeting ID, and meeting URL
        const [updatedMentorCalendarSlot, updatedStudentCalendarSlot] = await Promise.all([
          this.calendarService.updateSlotSessionId(
            mentorCalendarSlot.id,
            mentoringSession.id,
            tx,
            meetingInfo.id, // v4.1 - Link meeting_id for event-driven updates
            { meetingUrl: meetingInfo.meetingUrl }, // Add meetingUrl to metadata
          ),
          this.calendarService.updateSlotSessionId(
            studentCalendarSlot.id,
            mentoringSession.id,
            tx,
            meetingInfo.id, // v4.1 - Link meeting_id for event-driven updates
            { meetingUrl: meetingInfo.meetingUrl }, // Add meetingUrl to metadata
          ),
        ]);

        return {
          mentoringSession,
          hold,
          mentorCalendarSlot: updatedMentorCalendarSlot,
          studentCalendarSlot: updatedStudentCalendarSlot,
          meetingInfo,
        };
      });

      // Transaction succeeded
      addSpanEvent('booking.transaction.success');
      addSpanAttributes({
        'session.id': sessionResult.mentoringSession.id,
        'meeting.id': sessionResult.meetingInfo.id,// TODO: should be the hold ID, not the meeting ID
      });
    } catch (error) {
      this.logger.error(`Book session transaction rollback: ${error.message}`, error.stack);

      // Record failure event and metric
      addSpanEvent('booking.transaction.failed', {
        error_message: error.message,
      });

      this.metricsService.recordBookingFailure(error.message, {
        student_id: input.studentId,
        mentor_id: input.mentorId,
        error_type: error.constructor.name,
      });

      throw error;
    }

    const bookResult: SessionBookedEvent = {
      sessionId: sessionResult.mentoringSession.id,
      studentId: input.studentId,
      mentorId: input.mentorId,
      counselorId: input.counselorId,
      serviceType: input.serviceType,
      mentorCalendarSlotId: sessionResult.mentorCalendarSlot.id,
      studentCalendarSlotId: sessionResult.studentCalendarSlot.id,
      serviceHoldId: sessionResult.hold.id,
      // serviceHoldId: sessionResult.meetingInfo.id, 
      scheduledStartTime: input.scheduledStartTime,
      duration: input.duration,
      meetingUrl: sessionResult.meetingInfo.meetingUrl,
      meetingProvider: sessionResult.meetingInfo.provider,
      meetingPassword: sessionResult.meetingInfo.password,
    };

    this.logger.debug(
      `Emitting session booked event for session ${sessionResult.mentoringSession.id}`,
    );
    this.eventEmitter.emit(SESSION_BOOKED_EVENT, bookResult);

    // Record successful booking metrics
    const bookingDuration = Date.now() - bookingStartTime;
    this.metricsService.recordSessionBooked({
      student_id: input.studentId,
      mentor_id: input.mentorId,
      meeting_provider: input.meetingProvider || 'feishu',
      duration_minutes: input.duration,
    });
    this.metricsService.recordBookingDuration(bookingDuration, {
      student_id: input.studentId,
      mentor_id: input.mentorId,
    });

    addSpanEvent('booking.completed', {
      session_id: sessionResult.mentoringSession.id,
      duration_ms: bookingDuration,
    });

    return {
      ...bookResult,
      status: sessionResult.mentoringSession.status,
    };
  }
}
