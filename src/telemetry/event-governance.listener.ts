import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { HandlesEvent } from "@shared/events/registry";
import {
  AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT,
  COMM_SESSION_MEETING_OPERATION_RESULT_EVENT,
  GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT,
  MENTOR_APPEAL_CREATED_EVENT,
  MENTOR_APPEAL_REJECTED_EVENT,
  REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT,
  CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT,
} from "@shared/events/event-constants";
import { MEETING_RECORDING_READY_EVENT } from "@shared/events/meeting-recording-ready.event";
import { SESSION_BOOKED_EVENT } from "@shared/events/session-booked.event";
import type { IEvent } from "@shared/events";
import { MetricsService } from "./metrics.service";

@Injectable()
export class EventGovernanceTelemetryListener {
  private readonly logger = new Logger(EventGovernanceTelemetryListener.name);

  constructor(private readonly metricsService: MetricsService) {}

  @OnEvent(SESSION_BOOKED_EVENT)
  @HandlesEvent(SESSION_BOOKED_EVENT, "TelemetryModule")
  handleSessionBooked(event: IEvent<any>): void {
    const payload = event.payload ?? {};
    this.metricsService.recordSessionBooked({
      service_type: payload.serviceType ?? "unknown",
    });
    this.logger.debug(`Observed ${event.type} id=${event.id}`);
  }

  @OnEvent(MEETING_RECORDING_READY_EVENT)
  @HandlesEvent(MEETING_RECORDING_READY_EVENT, "TelemetryModule")
  handleMeetingRecordingReady(event: IEvent<any>): void {
    this.logger.debug(
      `Observed ${event.type} meetingId=${event.payload?.meetingId} id=${event.id}`,
    );
  }

  @OnEvent(REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT)
  @HandlesEvent(REGULAR_MENTORING_SESSION_MEETING_OPERATION_RESULT_EVENT, "TelemetryModule")
  handleRegularMentoringMeetingOperationResult(event: IEvent<any>): void {
    this.logger.debug(`Observed ${event.type} sessionId=${event.payload?.sessionId}`);
  }

  @OnEvent(GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT)
  @HandlesEvent(GAP_ANALYSIS_SESSION_MEETING_OPERATION_RESULT_EVENT, "TelemetryModule")
  handleGapAnalysisMeetingOperationResult(event: IEvent<any>): void {
    this.logger.debug(`Observed ${event.type} sessionId=${event.payload?.sessionId}`);
  }

  @OnEvent(AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT)
  @HandlesEvent(AI_CAREER_SESSION_MEETING_OPERATION_RESULT_EVENT, "TelemetryModule")
  handleAiCareerMeetingOperationResult(event: IEvent<any>): void {
    this.logger.debug(`Observed ${event.type} sessionId=${event.payload?.sessionId}`);
  }

  @OnEvent(COMM_SESSION_MEETING_OPERATION_RESULT_EVENT)
  @HandlesEvent(COMM_SESSION_MEETING_OPERATION_RESULT_EVENT, "TelemetryModule")
  handleCommSessionMeetingOperationResult(event: IEvent<any>): void {
    this.logger.debug(`Observed ${event.type} sessionId=${event.payload?.sessionId}`);
  }

  @OnEvent(CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT)
  @HandlesEvent(CLASS_SESSION_MEETING_OPERATION_RESULT_EVENT, "TelemetryModule")
  handleClassSessionMeetingOperationResult(event: IEvent<any>): void {
    this.logger.debug(`Observed ${event.type} sessionId=${event.payload?.sessionId}`);
  }

  @OnEvent(MENTOR_APPEAL_CREATED_EVENT)
  @HandlesEvent(MENTOR_APPEAL_CREATED_EVENT, "TelemetryModule")
  handleMentorAppealCreated(event: IEvent<any>): void {
    this.logger.debug(`Observed ${event.type} appealId=${event.payload?.appealId}`);
  }

  @OnEvent(MENTOR_APPEAL_REJECTED_EVENT)
  @HandlesEvent(MENTOR_APPEAL_REJECTED_EVENT, "TelemetryModule")
  handleMentorAppealRejected(event: IEvent<any>): void {
    this.logger.debug(`Observed ${event.type} appealId=${event.payload?.appealId}`);
  }
}

