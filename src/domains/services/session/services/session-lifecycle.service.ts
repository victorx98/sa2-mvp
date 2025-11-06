import { Injectable, Logger } from "@nestjs/common";
import { SessionService } from "./session.service";
import { SessionEventRepository } from "../repositories/session-event.repository";
import { SessionDurationCalculator } from "./session-duration-calculator";
import { SessionRecordingManager } from "../recording/session-recording-manager";
import { TranscriptPollingService } from "../recording/transcript-polling.service";
import { AISummaryService } from "../recording/ai-summary.service";
import { IWebhookEvent } from "@core/webhook/interfaces/webhook-handler.interface";
import { IRecording } from "../interfaces/session.interface";

/**
 * Session Lifecycle Service
 *
 * Handles session lifecycle events from webhooks
 * Updates session state based on meeting events (started, ended, recording, etc.)
 */
@Injectable()
export class SessionLifecycleService {
  private readonly logger = new Logger(SessionLifecycleService.name);

  constructor(
    private readonly sessionService: SessionService,
    private readonly sessionEventRepository: SessionEventRepository,
    private readonly durationCalculator: SessionDurationCalculator,
    private readonly recordingManager: SessionRecordingManager,
    private readonly transcriptPollingService: TranscriptPollingService,
    private readonly aiSummaryService: AISummaryService,
  ) {}

  /**
   * Handle meeting started event
   *
   * Updates actual_start_time and status to 'started'
   */
  async handleMeetingStarted(event: IWebhookEvent): Promise<void> {
    this.logger.debug(`Handling meeting started event: ${event.eventId}`);

    // Extract meeting ID from event data
    const meetingId = this.extractMeetingId(event.eventData);
    if (!meetingId) {
      this.logger.warn("No meeting ID found in event data");
      return;
    }

    // Find session by meeting ID
    const session = await this.sessionService.getSessionByMeetingId(meetingId);
    if (!session) {
      this.logger.warn(`Session not found for meeting ID: ${meetingId}`);
      return;
    }

    // Store event in session_events table
    await this.sessionEventRepository.create({
      sessionId: session.id,
      provider: this.extractProvider(event),
      eventType: event.eventType,
      eventData: event.eventData,
      occurredAt: new Date(event.timestamp),
    });

    // Update session: actual_start_time and status
    await this.sessionService.updateSession(session.id, {
      status: "started",
    });

    // Note: actual_start_time is updated via a database trigger or separate update
    // For now, we'll update it directly
    await this.sessionService["db"]
      .update(this.sessionService["db"].schema.sessions)
      .set({
        actualStartTime: new Date(event.timestamp),
        status: "started",
      })
      .where(
        this.sessionService["db"].eq(
          this.sessionService["db"].schema.sessions.id,
          session.id,
        ),
      )
      .returning();

    this.logger.log(`Meeting started for session: ${session.id}`);
  }

  /**
   * Handle meeting ended event
   *
   * Updates actual_end_time and calculates duration statistics
   */
  async handleMeetingEnded(event: IWebhookEvent): Promise<void> {
    this.logger.debug(`Handling meeting ended event: ${event.eventId}`);

    const meetingId = this.extractMeetingId(event.eventData);
    if (!meetingId) {
      this.logger.warn("No meeting ID found in event data");
      return;
    }

    const session = await this.sessionService.getSessionByMeetingId(meetingId);
    if (!session) {
      this.logger.warn(`Session not found for meeting ID: ${meetingId}`);
      return;
    }

    // Store event
    await this.sessionEventRepository.create({
      sessionId: session.id,
      provider: this.extractProvider(event),
      eventType: event.eventType,
      eventData: event.eventData,
      occurredAt: new Date(event.timestamp),
    });

    // Calculate duration statistics from all events
    const durationStats = await this.durationCalculator.calculateDurations(
      session.id,
    );

    // Update session with end time and duration stats
    await this.sessionService["db"]
      .update(this.sessionService["db"].schema.sessions)
      .set({
        actualEndTime: new Date(event.timestamp),
        status: "completed",
        mentorTotalDurationSeconds: durationStats.mentorTotalDurationSeconds,
        studentTotalDurationSeconds: durationStats.studentTotalDurationSeconds,
        effectiveTutoringDurationSeconds:
          durationStats.effectiveTutoringDurationSeconds,
        mentorJoinCount: durationStats.mentorJoinCount,
        studentJoinCount: durationStats.studentJoinCount,
      })
      .where(
        this.sessionService["db"].eq(
          this.sessionService["db"].schema.sessions.id,
          session.id,
        ),
      )
      .returning();

    this.logger.log(
      `Meeting ended for session: ${session.id}, Effective duration: ${durationStats.effectiveTutoringDurationSeconds}s`,
    );
  }

  /**
   * Handle recording ready event
   *
   * Appends recording record to session.recordings array and starts transcript polling
   */
  async handleRecordingReady(event: IWebhookEvent): Promise<void> {
    this.logger.debug(`Handling recording ready event: ${event.eventId}`);

    const meetingId = this.extractMeetingId(event.eventData);
    if (!meetingId) return;

    const session = await this.sessionService.getSessionByMeetingId(meetingId);
    if (!session) return;

    // Store event
    await this.sessionEventRepository.create({
      sessionId: session.id,
      provider: this.extractProvider(event),
      eventType: event.eventType,
      eventData: event.eventData,
      occurredAt: new Date(event.timestamp),
    });

    // Extract recording information
    const recordingData = this.extractRecordingInfo(event.eventData);

    if (recordingData) {
      // Use SessionRecordingManager to append recording
      const updatedRecordings = await this.recordingManager.appendRecording(
        session.id,
        recordingData,
      );

      this.logger.log(
        `Recording added to session: ${session.id}, Recording ID: ${recordingData.recordingId}`,
      );

      // Start transcript polling
      const provider = this.extractProvider(event);
      await this.transcriptPollingService.startPolling(
        session.id,
        recordingData.recordingId,
        meetingId,
        provider,
      );

      this.logger.log(
        `Started transcript polling for recording: ${recordingData.recordingId}`,
      );

      // Check if all transcripts are ready and generate AI summary if needed
      await this.checkAndGenerateAISummary(session.id);
    }
  }

  /**
   * Handle participant joined event
   *
   * Records join event for duration calculation
   */
  async handleParticipantJoined(event: IWebhookEvent): Promise<void> {
    this.logger.debug(`Handling participant joined event: ${event.eventId}`);

    const meetingId = this.extractMeetingId(event.eventData);
    if (!meetingId) return;

    const session = await this.sessionService.getSessionByMeetingId(meetingId);
    if (!session) return;

    // Store event for duration calculation
    await this.sessionEventRepository.create({
      sessionId: session.id,
      provider: this.extractProvider(event),
      eventType: event.eventType,
      eventData: event.eventData,
      occurredAt: new Date(event.timestamp),
    });

    this.logger.debug(
      `Participant joined event stored for session: ${session.id}`,
    );
  }

  /**
   * Handle participant left event
   *
   * Records leave event for duration calculation
   */
  async handleParticipantLeft(event: IWebhookEvent): Promise<void> {
    this.logger.debug(`Handling participant left event: ${event.eventId}`);

    const meetingId = this.extractMeetingId(event.eventData);
    if (!meetingId) return;

    const session = await this.sessionService.getSessionByMeetingId(meetingId);
    if (!session) return;

    // Store event for duration calculation
    await this.sessionEventRepository.create({
      sessionId: session.id,
      provider: this.extractProvider(event),
      eventType: event.eventType,
      eventData: event.eventData,
      occurredAt: new Date(event.timestamp),
    });

    this.logger.debug(
      `Participant left event stored for session: ${session.id}`,
    );
  }

  /**
   * Handle recording started event
   */
  async handleRecordingStarted(event: IWebhookEvent): Promise<void> {
    await this.storeGenericEvent(event, "Recording started");
  }

  /**
   * Handle recording ended event
   */
  async handleRecordingEnded(event: IWebhookEvent): Promise<void> {
    await this.storeGenericEvent(event, "Recording ended");
  }

  /**
   * Handle screen share started event
   */
  async handleShareStarted(event: IWebhookEvent): Promise<void> {
    await this.storeGenericEvent(event, "Share started");
  }

  /**
   * Handle screen share ended event
   */
  async handleShareEnded(event: IWebhookEvent): Promise<void> {
    await this.storeGenericEvent(event, "Share ended");
  }

  /**
   * Store generic event (for events that don't require special handling)
   */
  private async storeGenericEvent(
    event: IWebhookEvent,
    eventName: string,
  ): Promise<void> {
    this.logger.debug(`Handling ${eventName} event: ${event.eventId}`);

    const meetingId = this.extractMeetingId(event.eventData);
    if (!meetingId) return;

    const session = await this.sessionService.getSessionByMeetingId(meetingId);
    if (!session) return;

    await this.sessionEventRepository.create({
      sessionId: session.id,
      provider: this.extractProvider(event),
      eventType: event.eventType,
      eventData: event.eventData,
      occurredAt: new Date(event.timestamp),
    });

    this.logger.debug(`${eventName} event stored for session: ${session.id}`);
  }

  /**
   * Extract meeting ID from event data
   */
  private extractMeetingId(eventData: unknown): string | null {
    const data = eventData as {
      meeting?: { id?: string; meeting_id?: string };
      object?: { id?: string };
      reserve_id?: string;
    };

    return (
      data.meeting?.id ||
      data.meeting?.meeting_id ||
      data.object?.id ||
      data.reserve_id ||
      null
    );
  }

  /**
   * Extract provider from event
   */
  private extractProvider(event: IWebhookEvent): string {
    // Determine provider from event type
    if (event.eventType.startsWith("vc.meeting.")) {
      return "feishu";
    } else if (event.eventType.startsWith("meeting.")) {
      return "zoom";
    }
    return "unknown";
  }

  /**
   * Extract recording information from event data
   */
  private extractRecordingInfo(
    eventData: unknown,
  ): Omit<IRecording, "sequence"> | null {
    const data = eventData as {
      recording?: {
        recording_id?: string;
        url?: string;
        duration?: number;
        start_time?: string;
        end_time?: string;
      };
    };

    if (!data.recording) {
      return null;
    }

    const recording = data.recording;

    return {
      recordingId: recording.recording_id || `rec_${Date.now()}`,
      recordingUrl: recording.url || "",
      transcriptUrl: null,
      duration: recording.duration || 0,
      startedAt: recording.start_time
        ? new Date(recording.start_time)
        : new Date(),
      endedAt: recording.end_time ? new Date(recording.end_time) : new Date(),
    };
  }

  /**
   * Check if all transcripts are fetched and generate AI summary
   *
   * @param sessionId - Session ID
   */
  private async checkAndGenerateAISummary(sessionId: string): Promise<void> {
    try {
      const allFetched =
        await this.recordingManager.isAllTranscriptsFetched(sessionId);

      if (allFetched) {
        this.logger.log(
          `All transcripts fetched for session: ${sessionId}, generating AI summary`,
        );

        // Generate AI summary
        await this.aiSummaryService.generateSummary(sessionId);

        this.logger.log(`AI summary generated for session: ${sessionId}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to check/generate AI summary for session ${sessionId}: ${message}`,
      );
      // Don't throw error, just log warning
    }
  }
}
