import { Injectable, Logger } from "@nestjs/common";
import {
  IWebhookHandler,
  IWebhookEvent,
} from "../interfaces/webhook-handler.interface";
import { WebhookProcessingException } from "../exceptions/webhook.exception";
import { SessionLifecycleService } from "@domains/services/session/services/session-lifecycle.service";

/**
 * Feishu Webhook Event Types
 */
export enum FeishuEventType {
  MEETING_STARTED = "vc.meeting.meeting_started_v1",
  MEETING_ENDED = "vc.meeting.meeting_ended_v1",
  RECORDING_READY = "vc.meeting.recording_ready_v1",
  RECORDING_STARTED = "vc.meeting.recording_started_v1",
  RECORDING_ENDED = "vc.meeting.recording_ended_v1",
  JOIN_MEETING = "vc.meeting.join_meeting_v1",
  LEAVE_MEETING = "vc.meeting.leave_meeting_v1",
  SHARE_STARTED = "vc.meeting.share_started_v1",
  SHARE_ENDED = "vc.meeting.share_ended_v1",
}

/**
 * Feishu Webhook Handler
 *
 * Handles webhook events from Feishu (Lark) platform
 * Processes meeting lifecycle events and stores them in session_events table
 */
@Injectable()
export class FeishuWebhookHandler implements IWebhookHandler {
  private readonly logger = new Logger(FeishuWebhookHandler.name);

  constructor(
    private readonly sessionLifecycleService: SessionLifecycleService,
  ) {}

  /**
   * Get supported event types
   */
  getSupportedEventTypes(): string[] {
    return Object.values(FeishuEventType);
  }

  /**
   * Handle webhook event
   */
  async handleEvent(event: IWebhookEvent): Promise<void> {
    this.logger.debug(`Handling Feishu event: ${event.eventType}`);

    try {
      switch (event.eventType) {
        case FeishuEventType.MEETING_STARTED:
          await this.handleMeetingStarted(event);
          break;

        case FeishuEventType.MEETING_ENDED:
          await this.handleMeetingEnded(event);
          break;

        case FeishuEventType.RECORDING_READY:
          await this.handleRecordingReady(event);
          break;

        case FeishuEventType.RECORDING_STARTED:
          await this.handleRecordingStarted(event);
          break;

        case FeishuEventType.RECORDING_ENDED:
          await this.handleRecordingEnded(event);
          break;

        case FeishuEventType.JOIN_MEETING:
          await this.handleJoinMeeting(event);
          break;

        case FeishuEventType.LEAVE_MEETING:
          await this.handleLeaveMeeting(event);
          break;

        case FeishuEventType.SHARE_STARTED:
          await this.handleShareStarted(event);
          break;

        case FeishuEventType.SHARE_ENDED:
          await this.handleShareEnded(event);
          break;

        default:
          this.logger.warn(`Unsupported Feishu event type: ${event.eventType}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to handle Feishu event ${event.eventType}: ${message}`,
      );
      throw new WebhookProcessingException(event.eventType, message);
    }
  }

  /**
   * Handle meeting started event
   *
   * Updates actual_start_time and status to 'started'
   */
  private async handleMeetingStarted(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing meeting_started event");
    await this.sessionLifecycleService.handleMeetingStarted(event);
  }

  /**
   * Handle meeting ended event
   *
   * Updates actual_end_time and calculates duration statistics
   */
  private async handleMeetingEnded(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing meeting_ended event");
    await this.sessionLifecycleService.handleMeetingEnded(event);
  }

  /**
   * Handle recording ready event
   *
   * Appends recording record and starts transcript polling
   */
  private async handleRecordingReady(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing recording_ready event");
    await this.sessionLifecycleService.handleRecordingReady(event);
  }

  /**
   * Handle recording started event
   *
   * Records recording start time
   */
  private async handleRecordingStarted(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing recording_started event");
    await this.sessionLifecycleService.handleRecordingStarted(event);
  }

  /**
   * Handle recording ended event
   *
   * Records recording end time
   */
  private async handleRecordingEnded(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing recording_ended event");
    await this.sessionLifecycleService.handleRecordingEnded(event);
  }

  /**
   * Handle participant joined event
   *
   * Records join event for duration calculation
   */
  private async handleJoinMeeting(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing join_meeting event");
    await this.sessionLifecycleService.handleParticipantJoined(event);
  }

  /**
   * Handle participant left event
   *
   * Records leave event for duration calculation
   */
  private async handleLeaveMeeting(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing leave_meeting event");
    await this.sessionLifecycleService.handleParticipantLeft(event);
  }

  /**
   * Handle screen share started event
   *
   * Records screen share event
   */
  private async handleShareStarted(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing share_started event");
    await this.sessionLifecycleService.handleShareStarted(event);
  }

  /**
   * Handle screen share ended event
   *
   * Records screen share end event
   */
  private async handleShareEnded(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing share_ended event");
    await this.sessionLifecycleService.handleShareEnded(event);
  }
}
