import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  FeishuMeetingEventPayload,
  DomainEventNames,
} from "@core/webhook/events/domain-event-payloads";
import { SessionService } from "../services/session.service";
import { SessionRecordingManager } from "../recording/session-recording-manager";
import { SessionStatus } from "../interfaces/session.interface";

/**
 * Session Event Subscriber
 *
 * Subscribes to MeetingEventCreated domain events
 * Queries session table by meeting_no to identify sessions
 * Processes session-specific business logic
 */
@Injectable()
export class SessionEventSubscriber {
  private readonly logger = new Logger(SessionEventSubscriber.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly recordingManager: SessionRecordingManager,
  ) {}

  /**
   * Handle meeting started event
   * Listener for services.session.meeting_started domain event
   */
  @OnEvent(DomainEventNames.SESSION_MEETING_STARTED)
  async handleSessionMeetingStarted(
    payload: FeishuMeetingEventPayload,
  ): Promise<void> {
    this.logger.debug(
      `Received meeting_started event: ${payload.eventType} (${payload.eventId})`,
    );

    try {
      // 1. Query session by meeting_no
      if (!payload.meetingNo) {
        this.logger.debug("No meeting_no in event, skipping");
        return;
      }

      const session = await this.sessionService.getSessionByMeetingNo(
        payload.meetingNo,
      );

      if (!session) {
        this.logger.debug(
          `No session found for meeting_no: ${payload.meetingNo}`,
        );
        return;
      }

      this.logger.log(
        `Processing meeting_started event for session ${session.id}`,
      );

      // 2. Update session status and actual start time
      await this.sessionService.updateSession(session.id, {
        status: SessionStatus.STARTED,
        actualStartTime: payload.occurredAt,
      } as any);

      this.logger.log(`Session ${session.id} marked as started`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process meeting_started event: ${message}`,
      );
    }
  }

  /**
   * Handle meeting ended event
   * Listener for services.session.meeting_ended domain event
   *
   * Updates meeting time list and calculates actual service duration.
   * Supports multi-segment sessions by appending new meeting time segments.
   */
  @OnEvent(DomainEventNames.SESSION_MEETING_ENDED)
  async handleSessionMeetingEnded(
    payload: FeishuMeetingEventPayload,
  ): Promise<void> {
    this.logger.debug(
      `Received meeting_ended event: ${payload.eventType} (${payload.eventId})`,
    );

    try {
      // 1. Query session by meeting_no
      if (!payload.meetingNo) {
        this.logger.debug("No meeting_no in event, skipping");
        return;
      }

      const session = await this.sessionService.getSessionByMeetingNo(
        payload.meetingNo,
      );

      if (!session) {
        this.logger.debug(
          `No session found for meeting_no: ${payload.meetingNo}`,
        );
        return;
      }

      this.logger.log(
        `Processing meeting_ended event for session ${session.id}`,
      );

      // 2. Extract meeting start and end times from event payload
      const meetingStartTime = payload.meetingStartTime;
      const meetingEndTime = payload.meetingEndTime || payload.occurredAt;

      if (!meetingStartTime) {
        this.logger.warn(
          `No meeting start time found in event for session ${session.id}. Using current payload.occurredAt as start time.`,
        );
      }

      // 3. Build new meeting time segment
      const newTimeSegment = {
        startTime: meetingStartTime || payload.occurredAt,
        endTime: meetingEndTime,
      };

      // 4. Append to existing meeting time list
      const existingTimeList = (session.meetingTimeList as Array<{
        startTime: Date;
        endTime: Date;
      }>) || [];
      const updatedTimeList = [...existingTimeList, newTimeSegment];

      // 5. Calculate actual service duration (sum of all meeting segments in minutes)
      const actualServiceDuration = this.calculateTotalDuration(updatedTimeList);

      this.logger.log(
        `Meeting time segment added for session ${session.id}: startTime=${newTimeSegment.startTime}, endTime=${newTimeSegment.endTime}. Total actual service duration: ${actualServiceDuration} minutes.`,
      );

      // 6. Update session with new meeting time list and calculated service duration
      await this.sessionService.updateSession(session.id, {
        status: SessionStatus.COMPLETED,
        meetingTimeList: updatedTimeList,
        actualServiceDuration: actualServiceDuration,
      } as any);

      this.logger.log(
        `Session ${session.id} marked as completed with actual service duration: ${actualServiceDuration} minutes`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process meeting_ended event: ${message}`,
      );
    }
  }

  /**
   * Calculate total duration from meeting time segments in minutes
   * Sums up all meeting time segments
   *
   * @param timeList - Array of meeting time segments with startTime and endTime
   * @returns Total duration in minutes
   */
  private calculateTotalDuration(
    timeList: Array<{ startTime: Date; endTime: Date }>,
  ): number {
    if (!timeList || timeList.length === 0) {
      return 0;
    }

    let totalDurationMs = 0;
    for (const segment of timeList) {
      const startTime = new Date(segment.startTime).getTime();
      const endTime = new Date(segment.endTime).getTime();
      const durationMs = endTime - startTime;
      if (durationMs > 0) {
        totalDurationMs += durationMs;
      }
    }

    // Convert milliseconds to minutes
    return Math.round(totalDurationMs / (1000 * 60));
  }

  /**
   * Handle recording ready event
   * Listener for services.session.recording_ready domain event
   */
  @OnEvent(DomainEventNames.SESSION_RECORDING_READY)
  async handleSessionRecordingReady(
    payload: FeishuMeetingEventPayload,
  ): Promise<void> {
    this.logger.debug(
      `Received recording_ready event: ${payload.eventType} (${payload.eventId})`,
    );

    try {
      // 1. Query session by meeting_no
      if (!payload.meetingNo) {
        this.logger.debug("No meeting_no in event, skipping");
        return;
      }

      const session = await this.sessionService.getSessionByMeetingNo(
        payload.meetingNo,
      );

      if (!session) {
        this.logger.debug(
          `No session found for meeting_no: ${payload.meetingNo}`,
        );
        return;
      }

      this.logger.log(
        `Processing recording_ready event for session ${session.id}`,
      );

      // 2. Extract recording information from event data
      const recording = this.extractRecordingInfo(payload);

      if (recording) {
        await this.recordingManager.appendRecording(session.id, recording);
        this.logger.log(
          `Recording appended to session ${session.id}: ${recording.recordingId}`,
        );

        // TODO: Start transcript polling service
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process recording_ready event: ${message}`,
      );
    }
  }


  /**
   * Extract recording information from event payload
   * Platform-specific extraction logic
   */
  private extractRecordingInfo(payload: FeishuMeetingEventPayload): any | null {
    // For Feishu events, use the recordingId and recordingUrl from payload
    if (payload.recordingId && payload.recordingUrl) {
      return {
        recordingId: payload.recordingId,
        recordingUrl: payload.recordingUrl,
        duration: null,
        startedAt: payload.occurredAt,
        endedAt: null,
      };
    }

    // Fallback: try to extract from raw event data
    if (payload.eventData?.event?.recording) {
      const recording = payload.eventData.event.recording;
      return {
        recordingId: recording.id || recording.recording_id,
        recordingUrl: recording.url || recording.download_url,
        duration: recording.duration,
        startedAt: recording.started_at
          ? new Date(recording.started_at)
          : null,
        endedAt: recording.ended_at ? new Date(recording.ended_at) : null,
      };
    }

    this.logger.warn("Could not extract recording info from event payload");
    return null;
  }
}

