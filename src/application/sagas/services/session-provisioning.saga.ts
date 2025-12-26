import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { MeetingManagerService } from "@core/meeting";
import { CalendarService } from "@core/calendar";
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";
import { UserService } from "@domains/identity/user/user-service";
import { RegularMentoringDomainService } from "@domains/services/sessions/regular-mentoring/services/regular-mentoring-domain.service";
import { GapAnalysisDomainService } from "@domains/services/sessions/gap-analysis/services/gap-analysis-domain.service";
import { AiCareerDomainService } from "@domains/services/sessions/ai-career/services/ai-career-domain.service";
import { CommSessionDomainService } from "@domains/services/comm-sessions/services/comm-session-domain.service";
import { ClassSessionDomainService } from "@domains/services/class/class-sessions/services/class-session-domain.service";
import { SessionStatus as RegularMentoringStatus } from "@domains/services/sessions/regular-mentoring/value-objects/session-status.vo";
import { SessionStatus as GapAnalysisStatus } from "@domains/services/sessions/gap-analysis/value-objects/session-status.vo";
import { SessionStatus as AiCareerStatus } from "@domains/services/sessions/ai-career/value-objects/session-status.vo";
import { SessionStatus as CommSessionStatus } from "@domains/services/comm-sessions/value-objects/session-status.vo";
import { SessionStatus as ClassSessionStatus } from "@domains/services/class/class-sessions/value-objects/session-status.vo";
import {
  HandlesEvent,
  IntegrationEventPublisher,
  RegularMentoringSessionCreatedEvent,
  RegularMentoringSessionMeetingOperationResultEvent,
  GapAnalysisSessionCreatedEvent,
  GapAnalysisSessionMeetingOperationResultEvent,
  AiCareerSessionCreatedEvent,
  AiCareerSessionMeetingOperationResultEvent,
  CommSessionCreatedEvent,
  CommSessionMeetingOperationResultEvent,
  ClassSessionCreatedEvent,
  ClassSessionMeetingOperationResultEvent,
} from "@application/events";
import { SagaBase } from "@application/core/saga.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { retryWithBackoff } from "@shared/utils/retry.util";
import { FEISHU_DEFAULT_HOST_USER_ID } from "src/constants";

type CompensationResult = {
  requireManualIntervention: boolean;
  compensationErrors: string[];
};

@Injectable()
export class SessionProvisioningSaga extends SagaBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    eventPublisher: IntegrationEventPublisher,
    private readonly meetingManagerService: MeetingManagerService,
    private readonly calendarService: CalendarService,
    private readonly regularMentoringService: RegularMentoringDomainService,
    private readonly gapAnalysisService: GapAnalysisDomainService,
    private readonly aiCareerService: AiCareerDomainService,
    private readonly commSessionService: CommSessionDomainService,
    private readonly classSessionService: ClassSessionDomainService,
    private readonly serviceHoldService: ServiceHoldService,
    private readonly userService: UserService,
  ) {
    super(db, eventPublisher);
  }

  @OnEvent(RegularMentoringSessionCreatedEvent.eventType)
  @HandlesEvent(
    RegularMentoringSessionCreatedEvent.eventType,
    SessionProvisioningSaga.name,
  )
  async handleRegularMentoringCreated(
    event: RegularMentoringSessionCreatedEvent,
  ): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling regular_mentoring.session.created: sessionId=${payload.sessionId}`,
    );

    const session = await this.getRegularMentoringSession(payload.sessionId);
    if (!session) return;
    if (session.getStatus() !== RegularMentoringStatus.PENDING_MEETING) {
      this.logger.warn(
        `Skip regular_mentoring.session.created: sessionId=${payload.sessionId}, status=${session.getStatus()}`,
      );
      return;
    }

    let meetingId: string | undefined;
    try {
      const meeting = await this.createMeetingWithRetry({
        topic: payload.topic,
        provider: payload.meetingProvider,
        startTime: payload.scheduledStartTime,
        duration: payload.duration,
        autoRecord: true,
        participantJoinEarly: true,
      });
      meetingId = meeting.id;

      const mentorName = await this.userService.getDisplayName(payload.mentorId);
      const studentName = await this.userService.getDisplayName(payload.studentId);

      await this.withTransaction(async (tx) => {
        await this.regularMentoringService.scheduleMeeting(
          payload.sessionId,
          meeting.id,
          tx,
        );
        await this.calendarService.updateSlotWithSessionAndMeeting(
          payload.sessionId,
          meeting.id,
          meeting.meetingUrl,
          payload.mentorCalendarSlotId,
          payload.studentCalendarSlotId,
          mentorName,
          studentName,
          tx,
        );
      });

      await this.eventPublisher.publish(
        new RegularMentoringSessionMeetingOperationResultEvent({
          operation: "create",
          status: "success",
          sessionId: payload.sessionId,
          studentId: payload.studentId,
          mentorId: payload.mentorId,
          counselorId: payload.counselorId,
          scheduledAt: payload.scheduledStartTime,
          duration: payload.duration,
          meetingUrl: meeting.meetingUrl,
          meetingProvider: payload.meetingProvider,
          notifyRoles: ["counselor", "mentor", "student"],
        }),
        SessionProvisioningSaga.name,
      );
    } catch (error) {
      this.logger.error(
        `Failed to provision regular_mentoring session ${payload.sessionId}: ${this.stringifyError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      const compensation = await this.compensateCreateFailure({
        meetingId,
        holdId: session.getServiceHoldId(),
        slotIds: [payload.mentorCalendarSlotId, payload.studentCalendarSlotId],
        markMeetingFailed: () =>
          this.regularMentoringService.markMeetingFailed(payload.sessionId),
      });

      await this.eventPublisher.publish(
        new RegularMentoringSessionMeetingOperationResultEvent({
          operation: "create",
          status: "failed",
          sessionId: payload.sessionId,
          studentId: payload.studentId,
          mentorId: payload.mentorId,
          counselorId: payload.counselorId,
          scheduledAt: payload.scheduledStartTime,
          errorMessage: this.formatErrorMessage(error, compensation.compensationErrors),
          notifyRoles: ["counselor"],
          requireManualIntervention: compensation.requireManualIntervention,
        }),
        SessionProvisioningSaga.name,
      );
    }
  }

  @OnEvent(GapAnalysisSessionCreatedEvent.eventType)
  @HandlesEvent(
    GapAnalysisSessionCreatedEvent.eventType,
    SessionProvisioningSaga.name,
  )
  async handleGapAnalysisCreated(
    event: GapAnalysisSessionCreatedEvent,
  ): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling gap_analysis.session.created: sessionId=${payload.sessionId}`,
    );

    const session = await this.getGapAnalysisSession(payload.sessionId);
    if (!session) return;
    if (session.getStatus() !== GapAnalysisStatus.PENDING_MEETING) {
      this.logger.warn(
        `Skip gap_analysis.session.created: sessionId=${payload.sessionId}, status=${session.getStatus()}`,
      );
      return;
    }

    let meetingId: string | undefined;
    try {
      const meeting = await this.createMeetingWithRetry({
        topic: payload.topic,
        provider: payload.meetingProvider,
        startTime: payload.scheduledStartTime,
        duration: payload.duration,
        autoRecord: true,
        participantJoinEarly: true,
      });
      meetingId = meeting.id;

      const mentorName = await this.userService.getDisplayName(payload.mentorId);
      const studentName = await this.userService.getDisplayName(payload.studentId);

      await this.withTransaction(async (tx) => {
        await this.gapAnalysisService.scheduleMeeting(
          payload.sessionId,
          meeting.id,
          tx,
        );
        await this.calendarService.updateSlotWithSessionAndMeeting(
          payload.sessionId,
          meeting.id,
          meeting.meetingUrl,
          payload.mentorCalendarSlotId,
          payload.studentCalendarSlotId,
          mentorName,
          studentName,
          tx,
        );
      });

      await this.eventPublisher.publish(
        new GapAnalysisSessionMeetingOperationResultEvent({
          operation: "create",
          status: "success",
          sessionId: payload.sessionId,
          studentId: payload.studentId,
          mentorId: payload.mentorId,
          counselorId: payload.counselorId,
          scheduledAt: payload.scheduledStartTime,
          duration: payload.duration,
          meetingUrl: meeting.meetingUrl,
          meetingProvider: payload.meetingProvider,
          notifyRoles: ["counselor", "mentor", "student"],
        }),
        SessionProvisioningSaga.name,
      );
    } catch (error) {
      this.logger.error(
        `Failed to provision gap_analysis session ${payload.sessionId}: ${this.stringifyError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      const compensation = await this.compensateCreateFailure({
        meetingId,
        holdId: session.getServiceHoldId(),
        slotIds: [payload.mentorCalendarSlotId, payload.studentCalendarSlotId],
        markMeetingFailed: () =>
          this.gapAnalysisService.markMeetingFailed(payload.sessionId),
      });

      await this.eventPublisher.publish(
        new GapAnalysisSessionMeetingOperationResultEvent({
          operation: "create",
          status: "failed",
          sessionId: payload.sessionId,
          studentId: payload.studentId,
          mentorId: payload.mentorId,
          counselorId: payload.counselorId,
          scheduledAt: payload.scheduledStartTime,
          errorMessage: this.formatErrorMessage(error, compensation.compensationErrors),
          notifyRoles: ["counselor"],
          requireManualIntervention: compensation.requireManualIntervention,
        }),
        SessionProvisioningSaga.name,
      );
    }
  }

  @OnEvent(AiCareerSessionCreatedEvent.eventType)
  @HandlesEvent(AiCareerSessionCreatedEvent.eventType, SessionProvisioningSaga.name)
  async handleAiCareerCreated(event: AiCareerSessionCreatedEvent): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling ai_career.session.created: sessionId=${payload.sessionId}`,
    );

    const session = await this.getAiCareerSession(payload.sessionId);
    if (!session) return;
    if (session.getStatus() !== AiCareerStatus.PENDING_MEETING) {
      this.logger.warn(
        `Skip ai_career.session.created: sessionId=${payload.sessionId}, status=${session.getStatus()}`,
      );
      return;
    }

    let meetingId: string | undefined;
    try {
      const meeting = await this.createMeetingWithRetry({
        topic: payload.topic,
        provider: payload.meetingProvider,
        startTime: payload.scheduledStartTime,
        duration: payload.duration,
        autoRecord: true,
        participantJoinEarly: true,
      });
      meetingId = meeting.id;

      const mentorName = await this.userService.getDisplayName(payload.mentorId);
      const studentName = await this.userService.getDisplayName(payload.studentId);

      await this.withTransaction(async (tx) => {
        await this.aiCareerService.scheduleMeeting(
          payload.sessionId,
          meeting.id,
          tx,
        );
        await this.calendarService.updateSlotWithSessionAndMeeting(
          payload.sessionId,
          meeting.id,
          meeting.meetingUrl,
          payload.mentorCalendarSlotId,
          payload.studentCalendarSlotId,
          mentorName,
          studentName,
          tx,
        );
      });

      await this.eventPublisher.publish(
        new AiCareerSessionMeetingOperationResultEvent({
          operation: "create",
          status: "success",
          sessionId: payload.sessionId,
          studentId: payload.studentId,
          mentorId: payload.mentorId,
          counselorId: payload.counselorId,
          scheduledAt: payload.scheduledStartTime,
          duration: payload.duration,
          meetingUrl: meeting.meetingUrl,
          meetingProvider: payload.meetingProvider,
          notifyRoles: ["counselor", "mentor", "student"],
        }),
        SessionProvisioningSaga.name,
      );
    } catch (error) {
      this.logger.error(
        `Failed to provision ai_career session ${payload.sessionId}: ${this.stringifyError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      const compensation = await this.compensateCreateFailure({
        meetingId,
        holdId: session.getServiceHoldId(),
        slotIds: [payload.mentorCalendarSlotId, payload.studentCalendarSlotId],
        markMeetingFailed: () =>
          this.aiCareerService.markMeetingFailed(payload.sessionId),
      });

      await this.eventPublisher.publish(
        new AiCareerSessionMeetingOperationResultEvent({
          operation: "create",
          status: "failed",
          sessionId: payload.sessionId,
          studentId: payload.studentId,
          mentorId: payload.mentorId,
          counselorId: payload.counselorId,
          scheduledAt: payload.scheduledStartTime,
          errorMessage: this.formatErrorMessage(error, compensation.compensationErrors),
          notifyRoles: ["counselor"],
          requireManualIntervention: compensation.requireManualIntervention,
        }),
        SessionProvisioningSaga.name,
      );
    }
  }

  @OnEvent(CommSessionCreatedEvent.eventType)
  @HandlesEvent(CommSessionCreatedEvent.eventType, SessionProvisioningSaga.name)
  async handleCommSessionCreated(
    event: CommSessionCreatedEvent,
  ): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling comm_session.session.created: sessionId=${payload.sessionId}`,
    );

    const session = await this.getCommSession(payload.sessionId);
    if (!session) return;
    if (session.getStatus() !== CommSessionStatus.PENDING_MEETING) {
      this.logger.warn(
        `Skip comm_session.session.created: sessionId=${payload.sessionId}, status=${session.getStatus()}`,
      );
      return;
    }

    let meetingId: string | undefined;
    try {
      const meeting = await this.createMeetingWithRetry({
        topic: payload.topic,
        provider: payload.meetingProvider,
        startTime: payload.scheduledStartTime,
        duration: payload.duration,
        autoRecord: false,
        participantJoinEarly: true,
      });
      meetingId = meeting.id;

      const studentName = await this.userService.getDisplayName(payload.studentId);

      await this.withTransaction(async (tx) => {
        await this.commSessionService.scheduleMeeting(
          payload.sessionId,
          meeting.id,
          tx,
        );

        if (payload.mentorId && payload.mentorCalendarSlotId) {
          const mentorName = await this.userService.getDisplayName(payload.mentorId);
          await this.calendarService.updateSlotWithSessionAndMeeting(
            payload.sessionId,
            meeting.id,
            meeting.meetingUrl,
            payload.mentorCalendarSlotId,
            payload.studentCalendarSlotId,
            mentorName,
            studentName,
            tx,
          );
        } else {
          const counselorName = payload.counselorId
            ? await this.userService.getDisplayName(payload.counselorId)
            : "Counselor";
          await this.calendarService.updateSingleSlotWithSessionAndMeeting(
            payload.sessionId,
            meeting.id,
            meeting.meetingUrl,
            payload.studentCalendarSlotId,
            counselorName,
            tx,
          );
        }
      });

      await this.eventPublisher.publish(
        new CommSessionMeetingOperationResultEvent({
          operation: "create",
          status: "success",
          sessionId: payload.sessionId,
          studentId: payload.studentId,
          mentorId: payload.mentorId,
          counselorId: payload.counselorId,
          createdByCounselorId: payload.createdByCounselorId,
          scheduledAt: payload.scheduledStartTime,
          duration: payload.duration,
          meetingUrl: meeting.meetingUrl,
          meetingProvider: payload.meetingProvider,
          notifyRoles: ["counselor", "mentor", "student"],
        }),
        SessionProvisioningSaga.name,
      );
    } catch (error) {
      this.logger.error(
        `Failed to provision comm_session ${payload.sessionId}: ${this.stringifyError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      const compensation = await this.compensateCreateFailure({
        meetingId,
        slotIds: [payload.studentCalendarSlotId, payload.mentorCalendarSlotId],
        markMeetingFailed: () =>
          this.commSessionService.markMeetingFailed(payload.sessionId),
      });

      await this.eventPublisher.publish(
        new CommSessionMeetingOperationResultEvent({
          operation: "create",
          status: "failed",
          sessionId: payload.sessionId,
          studentId: payload.studentId,
          mentorId: payload.mentorId,
          counselorId: payload.counselorId,
          scheduledAt: payload.scheduledStartTime,
          errorMessage: this.formatErrorMessage(error, compensation.compensationErrors),
          notifyRoles: ["counselor"],
          requireManualIntervention: compensation.requireManualIntervention,
        }),
        SessionProvisioningSaga.name,
      );
    }
  }

  @OnEvent(ClassSessionCreatedEvent.eventType)
  @HandlesEvent(ClassSessionCreatedEvent.eventType, SessionProvisioningSaga.name)
  async handleClassSessionCreated(
    event: ClassSessionCreatedEvent,
  ): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Handling class_session.session.created: sessionId=${payload.sessionId}`,
    );

    const session = await this.getClassSession(payload.sessionId);
    if (!session) return;
    if (session.getStatus() !== ClassSessionStatus.PENDING_MEETING) {
      this.logger.warn(
        `Skip class_session.session.created: sessionId=${payload.sessionId}, status=${session.getStatus()}`,
      );
      return;
    }

    let meetingId: string | undefined;
    try {
      const classStudents = await this.db.query.classStudents.findMany({
        where: (classStudents, { eq }) =>
          eq(classStudents.classId, payload.classId),
      });
      const studentIds = classStudents.map((cs) => cs.studentUserId);

      const classCounselors = await this.db.query.classCounselors.findMany({
        where: (classCounselors, { eq }) =>
          eq(classCounselors.classId, payload.classId),
      });
      const counselorIds = classCounselors.map((cc) => cc.counselorUserId);

      const meeting = await this.createMeetingWithRetry({
        topic: payload.topic,
        provider: payload.meetingProvider,
        startTime: payload.scheduledStartTime,
        duration: payload.duration,
        autoRecord: true,
        participantJoinEarly: true,
      });
      meetingId = meeting.id;

      await this.withTransaction(async (tx) => {
        await this.classSessionService.markAsScheduled(
          payload.sessionId,
          meeting.id,
          tx,
        );
        await this.calendarService.updateSingleSlotWithSessionAndMeeting(
          payload.sessionId,
          meeting.id,
          meeting.meetingUrl,
          payload.mentorCalendarSlotId,
          "Class Session",
          tx,
        );
      });

      await this.eventPublisher.publish(
        new ClassSessionMeetingOperationResultEvent({
          operation: "create",
          status: "success",
          sessionId: payload.sessionId,
          classId: payload.classId,
          mentorId: payload.mentorId,
          counselorIds,
          studentIds,
          scheduledAt: payload.scheduledStartTime,
          duration: payload.duration,
          meetingUrl: meeting.meetingUrl,
          meetingProvider: payload.meetingProvider,
          notifyRoles: ["counselor", "mentor"],
        }),
        SessionProvisioningSaga.name,
      );
    } catch (error) {
      this.logger.error(
        `Failed to provision class_session ${payload.sessionId}: ${this.stringifyError(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      const compensation = await this.compensateCreateFailure({
        meetingId,
        slotIds: [payload.mentorCalendarSlotId],
        markMeetingFailed: () =>
          this.classSessionService.markMeetingFailed(payload.sessionId),
      });

      await this.eventPublisher.publish(
        new ClassSessionMeetingOperationResultEvent({
          operation: "create",
          status: "failed",
          sessionId: payload.sessionId,
          classId: payload.classId,
          mentorId: payload.mentorId,
          scheduledAt: payload.scheduledStartTime,
          errorMessage: this.formatErrorMessage(error, compensation.compensationErrors),
          notifyRoles: ["counselor"],
          requireManualIntervention: compensation.requireManualIntervention,
        }),
        SessionProvisioningSaga.name,
      );
    }
  }

  private async createMeetingWithRetry(input: {
    topic: string;
    provider: string;
    startTime: string | Date;
    duration: number;
    autoRecord: boolean;
    participantJoinEarly: boolean;
  }) {
    return retryWithBackoff(
      async () =>
        this.meetingManagerService.createMeeting({
          topic: input.topic,
          provider: input.provider as any,
          startTime:
            typeof input.startTime === "string"
              ? input.startTime
              : input.startTime.toISOString(),
          duration: input.duration,
          hostUserId: this.getHostUserId(input.provider),
          autoRecord: input.autoRecord,
          participantJoinEarly: input.participantJoinEarly,
        }),
      3,
      1000,
      this.logger,
    );
  }

  private async compensateCreateFailure(input: {
    meetingId?: string;
    holdId?: string | null;
    slotIds: Array<string | null | undefined>;
    markMeetingFailed: () => Promise<void>;
  }): Promise<CompensationResult> {
    const errors: string[] = [];

    if (input.meetingId) {
      try {
        await retryWithBackoff(
          async () => this.meetingManagerService.cancelMeeting(input.meetingId as string),
          3,
          1000,
          this.logger,
        );
      } catch (error) {
        errors.push(`cancelMeeting failed: ${this.stringifyError(error)}`);
      }
    }

    try {
      await input.markMeetingFailed();
    } catch (error) {
      errors.push(`markMeetingFailed failed: ${this.stringifyError(error)}`);
    }

    if (input.holdId) {
      try {
        await this.serviceHoldService.releaseHold(
          input.holdId,
          "meeting_create_failed",
        );
      } catch (error) {
        errors.push(`releaseHold failed: ${this.stringifyError(error)}`);
      }
    }

    const slotIds = input.slotIds.filter(
      (slotId): slotId is string => Boolean(slotId),
    );
    const slotResults = await Promise.allSettled(
      slotIds.map((slotId) => this.calendarService.cancelSlot(slotId)),
    );
    slotResults.forEach((result, index) => {
      if (result.status === "rejected") {
        const message = this.stringifyError(result.reason);
        if (!message.includes("already cancelled")) {
          errors.push(`cancelSlot failed: slotId=${slotIds[index]} ${message}`);
        }
      }
    });

    return {
      requireManualIntervention: errors.length > 0,
      compensationErrors: errors,
    };
  }

  private formatErrorMessage(error: unknown, compensationErrors: string[]): string {
    const base = this.stringifyError(error);
    if (compensationErrors.length === 0) {
      return base;
    }
    return `${base}; compensation: ${compensationErrors.join(" | ")}`;
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  private getHostUserId(provider: string): string | undefined {
    return provider === "feishu" ? FEISHU_DEFAULT_HOST_USER_ID : undefined;
  }

  private async getRegularMentoringSession(sessionId: string) {
    try {
      return await this.regularMentoringService.getSessionById(sessionId);
    } catch (error) {
      this.logger.error(
        `Regular mentoring session not found: sessionId=${sessionId} ${this.stringifyError(error)}`,
      );
      return null;
    }
  }

  private async getGapAnalysisSession(sessionId: string) {
    try {
      return await this.gapAnalysisService.getSessionById(sessionId);
    } catch (error) {
      this.logger.error(
        `Gap analysis session not found: sessionId=${sessionId} ${this.stringifyError(error)}`,
      );
      return null;
    }
  }

  private async getAiCareerSession(sessionId: string) {
    try {
      return await this.aiCareerService.getSessionById(sessionId);
    } catch (error) {
      this.logger.error(
        `AI career session not found: sessionId=${sessionId} ${this.stringifyError(error)}`,
      );
      return null;
    }
  }

  private async getCommSession(sessionId: string) {
    try {
      return await this.commSessionService.getSessionById(sessionId);
    } catch (error) {
      this.logger.error(
        `Comm session not found: sessionId=${sessionId} ${this.stringifyError(error)}`,
      );
      return null;
    }
  }

  private async getClassSession(sessionId: string) {
    try {
      const session = await this.classSessionService.findById(sessionId);
      if (!session) {
        this.logger.error(`Class session not found: sessionId=${sessionId}`);
        return null;
      }
      return session;
    } catch (error) {
      this.logger.error(
        `Class session not found: sessionId=${sessionId} ${this.stringifyError(error)}`,
      );
      return null;
    }
  }
}
