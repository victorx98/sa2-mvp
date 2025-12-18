/**
 * Session Booking Saga
 * 会话预约 Saga
 *
 * Orchestrates the async portion of session booking after the sync command completes.
 *
 * Sync Command (BookSessionCommand) completes:
 * - Step 1: Create service hold
 * - Step 2: Create calendar slots
 * - Step 4: Create session record (status = PENDING_MEETING)
 * → Returns session details to frontend immediately
 *
 * This Saga handles (async):
 * - Step 3: Create meeting on provider (Feishu/Zoom) with retry
 * - Step 5: Update session with meeting info
 * - Step 6: Update calendar slots with meeting URL
 * - Step 7: Publish SESSION_BOOKED event
 *
 * On Failure:
 * - Cancel meeting if created
 * - Update session status to MEETING_FAILED
 * - Notify counselor for manual intervention
 *
 * 编排会话预约的异步部分（同步命令完成后）。
 *
 * 同步命令（BookSessionCommand）完成：
 * - 步骤 1：创建服务预占
 * - 步骤 2：创建日历槽位
 * - 步骤 4：创建会话记录（状态 = PENDING_MEETING）
 * → 立即返回会话详情给前端
 *
 * 此 Saga 处理（异步）：
 * - 步骤 3：在提供商上创建会议（飞书/Zoom），带重试
 * - 步骤 5：用会议信息更新会话
 * - 步骤 6：用会议 URL 更新日历槽位
 * - 步骤 7：发布 SESSION_BOOKED 事件
 *
 * 失败时：
 * - 取消已创建的会议
 * - 更新会话状态为 MEETING_FAILED
 * - 通知顾问进行人工处理
 */

import { Injectable, Logger, Inject } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import { SagaOrchestrator } from "./saga-orchestrator";
import {
  SagaDefinition,
  SagaStep,
  SagaContext,
  SagaResult,
  SagaStepErrorStrategy,
} from "./types";

import { MeetingManagerService } from "@core/meeting";
import { CalendarService } from "@core/calendar";
import { RegularMentoringService } from "@domains/services/sessions/regular-mentoring/services/regular-mentoring.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import {
  SESSION_BOOKED_EVENT,
  REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT,
} from "@shared/events/event-constants";
import { FEISHU_DEFAULT_HOST_USER_ID } from "src/constants";
import { MeetingProviderType } from "@core/meeting";

/**
 * Input for session booking saga
 * 会话预约 Saga 的输入
 */
export interface SessionBookingSagaInput {
  /**
   * Session ID (already created by sync command)
   * 会话 ID（已由同步命令创建）
   */
  sessionId: string;

  /**
   * Student user ID
   * 学生用户 ID
   */
  studentId: string;

  /**
   * Mentor user ID
   * 导师用户 ID
   */
  mentorId: string;

  /**
   * Counselor user ID
   * 顾问用户 ID
   */
  counselorId: string;

  /**
   * Meeting topic/title
   * 会议主题/标题
   */
  topic?: string;

  /**
   * Meeting provider (feishu/zoom)
   * 会议提供商（飞书/Zoom）
   */
  meetingProvider: string;

  /**
   * Scheduled start time
   * 计划开始时间
   */
  scheduledStartTime: Date;

  /**
   * Duration in minutes
   * 时长（分钟）
   */
  duration: number;

  /**
   * Mentor calendar slot ID
   * 导师日历槽位 ID
   */
  mentorCalendarSlotId: string;

  /**
   * Student calendar slot ID
   * 学生日历槽位 ID
   */
  studentCalendarSlotId: string;

  /**
   * Service type (for event payload)
   * 服务类型（用于事件负载）
   */
  serviceType?: string;

  /**
   * Service hold ID (for event payload)
   * 服务预占 ID（用于事件负载）
   */
  serviceHoldId?: string;
}

/**
 * Output from session booking saga
 * 会话预约 Saga 的输出
 */
export interface SessionBookingSagaOutput {
  /**
   * Session ID
   * 会话 ID
   */
  sessionId: string;

  /**
   * Created meeting ID
   * 创建的会议 ID
   */
  meetingId: string;

  /**
   * Meeting URL
   * 会议 URL
   */
  meetingUrl: string;

  /**
   * Whether saga completed successfully
   * Saga 是否成功完成
   */
  success: boolean;
}

/**
 * Internal step data passed between saga steps
 * Saga 步骤之间传递的内部步骤数据
 */
interface StepData extends SessionBookingSagaInput {
  meetingId?: string;
  meetingUrl?: string;
  meetingNo?: string;
}

/**
 * Session Booking Saga Service
 * 会话预约 Saga 服务
 *
 * Provides saga definition and execution for session booking.
 * 提供会话预约的 Saga 定义和执行。
 */
@Injectable()
export class SessionBookingSaga {
  private readonly logger = new Logger(SessionBookingSaga.name);

  constructor(
    private readonly orchestrator: SagaOrchestrator,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly calendarService: CalendarService,
    private readonly sessionService: RegularMentoringService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
  ) {}

  /**
   * Saga definition for session booking
   * 会话预约的 Saga 定义
   */
  get definition(): SagaDefinition<SessionBookingSagaInput, SessionBookingSagaOutput> {
    return {
      id: "session-booking",
      name: "Session Booking Saga",
      description: "Orchestrates async meeting creation after session is created",
      version: "1.0",
      timeout: 120000, // 2 minutes overall timeout

      steps: [
        this.createMeetingStep(),
        this.updateSessionStep(),
        this.updateCalendarStep(),
        this.publishEventsStep(),
      ],

      onComplete: async (result, context) => {
        this.logger.log(
          `Session booking saga completed: sessionId=${result.sessionId}, ` +
          `meetingId=${result.meetingId} [${context.correlationId}]`,
        );
      },

      onFailed: async (error, context) => {
        this.logger.error(
          `Session booking saga failed: ${error.message} [${context.correlationId}]`,
        );

        // Get session ID from context
        const sessionId = (context.metadata.originalInput as SessionBookingSagaInput)?.sessionId;

        if (sessionId) {
          // Update session status to MEETING_FAILED
          try {
            await this.sessionService.markMeetingFailed(sessionId);
            this.logger.debug(`Session ${sessionId} marked as MEETING_FAILED`);
          } catch (err) {
            this.logger.error(`Failed to mark session as MEETING_FAILED: ${err.message}`);
          }
        }

        // Emit failure result event for counselor notification
        const input = context.metadata.originalInput as SessionBookingSagaInput;
        this.eventEmitter.emit(REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT, {
          operation: "create",
          status: "failed",
          sessionId: input?.sessionId,
          studentId: input?.studentId,
          mentorId: input?.mentorId,
          counselorId: input?.counselorId,
          scheduledAt: input?.scheduledStartTime,
          errorMessage: error.message,
          notifyRoles: ["counselor"],
          requireManualIntervention: true,
          compensatedSteps: context.compensatedSteps,
        });
      },

      tags: ["session", "booking", "meeting", "critical-path"],
    };
  }

  /**
   * Step 1: Create Meeting on Provider
   * 步骤 1：在提供商上创建会议
   */
  private createMeetingStep(): SagaStep<StepData, StepData> {
    return {
      id: "create-meeting",
      name: "Create Meeting on Provider",
      description: "Create meeting on Feishu/Zoom with retry",
      timeout: 60000, // 60 seconds for external API
      retries: 3, // Retry up to 3 times
      retryDelay: 1000, // Start with 1 second, exponential backoff
      onError: SagaStepErrorStrategy.FAIL, // Fail saga on error

      execute: async (input: StepData, context: SagaContext): Promise<StepData> => {
        this.logger.debug(
          `Creating meeting for session ${input.sessionId} [${context.correlationId}]`,
        );

        // Determine host user ID based on provider
        const provider = (input.meetingProvider as MeetingProviderType) || MeetingProviderType.FEISHU;
        const hostUserId = provider === MeetingProviderType.FEISHU
          ? FEISHU_DEFAULT_HOST_USER_ID
          : undefined;

        const meeting = await this.meetingManagerService.createMeeting({
          topic: input.topic || "Mentoring Session",
          startTime: input.scheduledStartTime.toISOString(),
          duration: input.duration,
          provider: provider,
          hostUserId: hostUserId,
          autoRecord: true,
          participantJoinEarly: true,
        });

        this.logger.debug(
          `Meeting created: id=${meeting.id}, url=${meeting.meetingUrl}`,
        );

        return {
          ...input,
          meetingId: meeting.id,
          meetingUrl: meeting.meetingUrl,
          meetingNo: meeting.meetingNo,
        };
      },

      compensate: async (input: StepData, output: StepData | undefined, context: SagaContext): Promise<void> => {
        // Only compensate if meeting was created
        if (!output?.meetingId) {
          this.logger.debug("No meeting to compensate (not created yet)");
          return;
        }

        this.logger.debug(
          `Compensating: Cancelling meeting ${output.meetingId} [${context.correlationId}]`,
        );

        try {
          await this.meetingManagerService.cancelMeeting(output.meetingId);
          this.logger.debug(`Meeting ${output.meetingId} cancelled successfully`);
        } catch (error) {
          // Log but don't fail - meeting might already be cancelled or not found
          this.logger.warn(
            `Failed to cancel meeting ${output.meetingId}: ${error.message}`,
          );
        }
      },
    };
  }

  /**
   * Step 2: Update Session with Meeting Info
   * 步骤 2：用会议信息更新会话
   */
  private updateSessionStep(): SagaStep<StepData, StepData> {
    return {
      id: "update-session",
      name: "Update Session with Meeting Info",
      description: "Update session record with meeting ID and status",
      timeout: 10000, // 10 seconds
      onError: SagaStepErrorStrategy.FAIL,

      execute: async (input: StepData, context: SagaContext): Promise<StepData> => {
        this.logger.debug(
          `Updating session ${input.sessionId} with meeting ${input.meetingId} [${context.correlationId}]`,
        );

        await this.sessionService.completeMeetingSetup(
          input.sessionId,
          input.meetingId!,
        );

        this.logger.debug(`Session ${input.sessionId} updated with meeting info`);

        return input;
      },

      // No compensation - session status will be updated to MEETING_FAILED in onFailed
      compensate: undefined,
    };
  }

  /**
   * Step 3: Update Calendar Slots with Meeting URL
   * 步骤 3：用会议 URL 更新日历槽位
   */
  private updateCalendarStep(): SagaStep<StepData, StepData> {
    return {
      id: "update-calendar",
      name: "Update Calendar Slots",
      description: "Update calendar slots with session and meeting info",
      timeout: 10000, // 10 seconds
      onError: SagaStepErrorStrategy.SKIP, // Non-critical, skip on error
      critical: false, // Don't compensate if this fails

      execute: async (input: StepData, context: SagaContext): Promise<StepData> => {
        this.logger.debug(
          `Updating calendar slots for session ${input.sessionId} [${context.correlationId}]`,
        );

        await this.calendarService.updateSlotWithSessionAndMeeting(
          input.sessionId,
          input.meetingId!,
          input.meetingUrl!,
          input.mentorCalendarSlotId,
          input.studentCalendarSlotId,
        );

        this.logger.debug(
          `Calendar slots updated: mentor=${input.mentorCalendarSlotId}, student=${input.studentCalendarSlotId}`,
        );

        return input;
      },

      // No compensation needed - calendar slots can be manually fixed
      compensate: undefined,
    };
  }

  /**
   * Step 4: Publish Events
   * 步骤 4：发布事件
   */
  private publishEventsStep(): SagaStep<StepData, SessionBookingSagaOutput> {
    return {
      id: "publish-events",
      name: "Publish Booking Events",
      description: "Publish SESSION_BOOKED and operation result events",
      timeout: 5000, // 5 seconds
      onError: SagaStepErrorStrategy.SKIP, // Non-critical
      critical: false,

      execute: async (input: StepData, context: SagaContext): Promise<SessionBookingSagaOutput> => {
        this.logger.debug(
          `Publishing events for session ${input.sessionId} [${context.correlationId}]`,
        );

        // Emit SESSION_BOOKED event
        this.eventEmitter.emit(SESSION_BOOKED_EVENT, {
          sessionId: input.sessionId,
          studentId: input.studentId,
          mentorId: input.mentorId,
          counselorId: input.counselorId,
          serviceType: input.serviceType || "regular_mentoring",
          mentorCalendarSlotId: input.mentorCalendarSlotId,
          studentCalendarSlotId: input.studentCalendarSlotId,
          serviceHoldId: input.serviceHoldId,
          scheduledStartTime: input.scheduledStartTime,
          duration: input.duration,
          meetingProvider: input.meetingProvider,
          meetingPassword: null,
          meetingUrl: input.meetingUrl,
        });

        this.logger.debug(`SESSION_BOOKED_EVENT emitted for session ${input.sessionId}`);

        // Emit operation result event (success)
        this.eventEmitter.emit(REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT, {
          operation: "create",
          status: "success",
          sessionId: input.sessionId,
          studentId: input.studentId,
          mentorId: input.mentorId,
          counselorId: input.counselorId,
          scheduledAt: input.scheduledStartTime,
          meetingUrl: input.meetingUrl,
          notifyRoles: ["counselor", "mentor", "student"],
        });

        this.logger.debug(`MEETING_OPERATION_RESULT_EVENT emitted for session ${input.sessionId}`);

        return {
          sessionId: input.sessionId,
          meetingId: input.meetingId!,
          meetingUrl: input.meetingUrl!,
          success: true,
        };
      },

      // No compensation needed for events
      compensate: undefined,
    };
  }

  /**
   * Execute the session booking saga
   * 执行会话预约 Saga
   *
   * @param input - Saga input (session details from sync command)
   * @returns Saga execution result
   */
  async execute(input: SessionBookingSagaInput): Promise<SagaResult<SessionBookingSagaOutput>> {
    this.logger.log(
      `Executing session booking saga for session ${input.sessionId}`,
    );

    // Store original input in metadata for onFailed callback
    const result = await this.orchestrator.execute(
      this.definition,
      input as StepData,
      {
        metadata: {
          originalInput: input,
        },
      },
    );

    if (result.success) {
      this.logger.log(
        `Session booking saga succeeded: sessionId=${input.sessionId}, ` +
        `duration=${result.duration}ms, steps=${result.executedSteps.length}`,
      );
    } else {
      this.logger.warn(
        `Session booking saga failed: sessionId=${input.sessionId}, ` +
        `error=${result.error?.message}, ` +
        `compensated=${result.compensatedSteps.length}`,
      );
    }

    return result;
  }
}
