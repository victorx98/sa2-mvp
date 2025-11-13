import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { MeetingEventCreated } from "@core/webhook/dto/meeting-event-created.event";
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
   * Handle meeting event domain events
   * Flow: Query session by meeting_no → Process if found → Ignore if not found
   */
  @OnEvent("MeetingEventCreated")
  async handleMeetingEvent(event: MeetingEventCreated): Promise<void> {
    this.logger.debug(
      `Received meeting event: ${event.eventType} (${event.eventId})`,
    );

    // 1. Query session table by meeting_no (key field for identifying sessions)
    if (!event.meetingNo) {
      this.logger.debug("No meeting_no in event, skipping (Zoom event?)");
      return;
    }

    const session = await this.sessionService.getSessionByMeetingNo(
      event.meetingNo,
    );

    // 2. If session not found, this event doesn't belong to session domain
    if (!session) {
      this.logger.debug(
        `No session found for meeting_no: ${event.meetingNo}, ignoring`,
      );
      return;
    }

    this.logger.log(
      `Processing event ${event.eventType} for session ${session.id}`,
    );

    // 3. Route to specific handler based on event type
    try {
      switch (event.eventType) {
        case "vc.meeting.meeting_started_v1":
        case "meeting.started":
          await this.handleMeetingStarted(session.id, event.occurredAt);
          break;

        case "vc.meeting.meeting_ended_v1":
        case "meeting.ended":
          await this.handleMeetingEnded(session.id, event.occurredAt);
          break;

        case "vc.meeting.recording_ready_v1":
        case "recording.completed":
          await this.handleRecordingReady(session.id, event);
          break;

        case "vc.meeting.join_meeting_v1":
        case "meeting.participant_joined":
          await this.handleParticipantJoined(
            session.id,
            event.operatorId,
            event.occurredAt,
          );
          break;

        case "vc.meeting.leave_meeting_v1":
        case "meeting.participant_left":
          await this.handleParticipantLeft(
            session.id,
            event.operatorId,
            event.occurredAt,
          );
          break;

        default:
          this.logger.debug(`Unhandled event type: ${event.eventType}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process event ${event.eventType} for session ${session.id}: ${message}`,
      );
      // Don't throw - event is already stored in database for retry
    }
  }

  /**
   * Handle meeting started event
   * Update actual_start_time and status to 'started'
   */
  private async handleMeetingStarted(
    sessionId: string,
    occurredAt: Date,
  ): Promise<void> {
    this.logger.debug(`Updating session ${sessionId} to started`);

    await this.sessionService.updateSession(sessionId, {
      status: SessionStatus.STARTED,
      actualStartTime: occurredAt,
    } as any);

    this.logger.log(`Session ${sessionId} marked as started`);
  }

  /**
   * Handle meeting ended event
   * Update actual_end_time and status to 'completed'
   * Duration calculation will be done later by SessionDurationCalculator
   */
  private async handleMeetingEnded(
    sessionId: string,
    occurredAt: Date,
  ): Promise<void> {
    this.logger.debug(`Updating session ${sessionId} to completed`);

    await this.sessionService.updateSession(sessionId, {
      status: SessionStatus.COMPLETED,
      actualEndTime: occurredAt,
    } as any);

    this.logger.log(`Session ${sessionId} marked as completed`);

    // TODO: Trigger duration calculation asynchronously
    // Can be done via job queue or immediate calculation
  }

  /**
   * Handle recording ready event
   * Append recording to recordings array and start transcript polling
   */
  private async handleRecordingReady(
    sessionId: string,
    event: MeetingEventCreated,
  ): Promise<void> {
    this.logger.debug(`Processing recording ready for session ${sessionId}`);

    // Extract recording information from event data
    const recording = this.extractRecordingInfo(event.eventData);

    if (recording) {
      await this.recordingManager.appendRecording(sessionId, recording);
      this.logger.log(
        `Recording appended to session ${sessionId}: ${recording.recordingId}`,
      );

      // TODO: Start transcript polling service
      // await this.transcriptPollingService.startPolling(sessionId, recording.recordingId);
    }
  }

  /**
   * Handle participant joined event
   * Update join count (will be used for duration calculation)
   */
  private async handleParticipantJoined(
    sessionId: string,
    operatorId: string | null,
    occurredAt: Date,
  ): Promise<void> {
    this.logger.debug(
      `Participant ${operatorId} joined session ${sessionId}`,
    );

    // Join events are already stored in meeting_events table
    // Duration calculation will query from there
    // No need to update session record here
  }

  /**
   * Handle participant left event
   * Update leave count (will be used for duration calculation)
   */
  private async handleParticipantLeft(
    sessionId: string,
    operatorId: string | null,
    occurredAt: Date,
  ): Promise<void> {
    this.logger.debug(`Participant ${operatorId} left session ${sessionId}`);

    // Leave events are already stored in meeting_events table
    // Duration calculation will query from there
    // No need to update session record here
  }

  /**
   * Extract recording information from event data
   * Platform-specific extraction logic
   */
  private extractRecordingInfo(eventData: Record<string, any>): any | null {
    // Feishu recording format
    if (eventData.event?.recording) {
      const recording = eventData.event.recording;
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

    // Zoom recording format
    if (eventData.payload?.object?.recording_files) {
      const files = eventData.payload.object.recording_files;
      if (files && files.length > 0) {
        const file = files[0]; // Use first recording file
        return {
          recordingId: file.id,
          recordingUrl: file.download_url,
          duration: file.recording_end
            ? new Date(file.recording_end).getTime() -
              new Date(file.recording_start).getTime()
            : null,
          startedAt: file.recording_start
            ? new Date(file.recording_start)
            : null,
          endedAt: file.recording_end ? new Date(file.recording_end) : null,
        };
      }
    }

    this.logger.warn("Could not extract recording info from event data");
    return null;
  }
}

