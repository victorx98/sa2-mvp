import { Injectable, Logger } from "@nestjs/common";
import {
  IWebhookHandler,
  IWebhookEvent,
} from "../interfaces/webhook-handler.interface";
import { WebhookProcessingException } from "../exceptions/webhook.exception";
import { FeishuEventExtractor } from "../extractors/feishu-event-extractor";
import { MeetingEventService } from "@core/meeting-providers/services/meeting-event.service";
import { WebhookEventBusService } from "../services/webhook-event-bus.service";
import {
  FeishuMeetingEventPayload,
  DomainEventNames,
} from "../events/domain-event-payloads";

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
 * Processes webhook events from Feishu (Lark) platform
 * Flow: Extract → Store → Publish domain event
 */
@Injectable()
export class FeishuWebhookHandler implements IWebhookHandler {
  private readonly logger = new Logger(FeishuWebhookHandler.name);

  constructor(
    private readonly feishuEventExtractor: FeishuEventExtractor,
    private readonly meetingEventService: MeetingEventService,
    private readonly eventBus: WebhookEventBusService,
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
   * Generic event processor: Extract → Store → Publish
   *
   * @param rawEvent - Raw webhook event
   */
  private async processEvent(rawEvent: IWebhookEvent): Promise<void> {
    // 1. Extract structured fields from raw webhook data
    const extractedData = this.feishuEventExtractor.extract(
      rawEvent.eventData as any,
    );

    this.logger.debug(
      `Extracted event: ${extractedData.eventType} (${extractedData.eventId})`,
    );

    // 2. Store event in meeting_events table (with automatic deduplication)
    await this.meetingEventService.recordEvent(extractedData);

    // 3. Build event payload with all extracted data
    const eventPayload: FeishuMeetingEventPayload = {
      meetingId: extractedData.meetingId,
      meetingNo: extractedData.meetingNo,
      eventId: extractedData.eventId,
      eventType: extractedData.eventType,
      provider: extractedData.provider,
      operatorId: extractedData.operatorId,
      operatorRole: extractedData.operatorRole,
      meetingTopic: extractedData.meetingTopic,
      meetingStartTime: extractedData.meetingStartTime,
      meetingEndTime: extractedData.meetingEndTime,
      recordingId: extractedData.recordingId,
      recordingUrl: extractedData.recordingUrl,
      occurredAt: extractedData.occurredAt,
      eventData: extractedData.eventData,
    };

    // 4. Publish domain events based on event type
    // Only publish for supported event types (meeting_started, meeting_ended, recording_ready)
    switch (extractedData.eventType) {
      case FeishuEventType.MEETING_STARTED:
        await this.eventBus.emit(
          DomainEventNames.SESSION_MEETING_STARTED,
          eventPayload,
        );
        this.logger.log(
          `Event published: ${DomainEventNames.SESSION_MEETING_STARTED}`,
        );
        break;

      case FeishuEventType.MEETING_ENDED:
        await this.eventBus.emit(
          DomainEventNames.SESSION_MEETING_ENDED,
          eventPayload,
        );
        this.logger.log(
          `Event published: ${DomainEventNames.SESSION_MEETING_ENDED}`,
        );
        break;

      case FeishuEventType.RECORDING_READY:
        await this.eventBus.emit(
          DomainEventNames.SESSION_RECORDING_READY,
          eventPayload,
        );
        this.logger.log(
          `Event published: ${DomainEventNames.SESSION_RECORDING_READY}`,
        );
        break;

      default:
        // Other event types are stored but not published as domain events
        this.logger.debug(
          `Event type ${extractedData.eventType} is stored but not published as domain event`,
        );
    }
  }

  /**
   * Handle meeting started event
   */
  private async handleMeetingStarted(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing meeting_started event");
    await this.processEvent(event);
  }

  /**
   * Handle meeting ended event
   */
  private async handleMeetingEnded(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing meeting_ended event");
    await this.processEvent(event);
  }

  /**
   * Handle recording ready event
   */
  private async handleRecordingReady(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing recording_ready event");
    await this.processEvent(event);
  }

  /**
   * Handle recording started event
   */
  private async handleRecordingStarted(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing recording_started event");
    await this.processEvent(event);
  }

  /**
   * Handle recording ended event
   */
  private async handleRecordingEnded(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing recording_ended event");
    await this.processEvent(event);
  }

  /**
   * Handle participant joined event
   */
  private async handleJoinMeeting(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing join_meeting event");
    await this.processEvent(event);
  }

  /**
   * Handle participant left event
   */
  private async handleLeaveMeeting(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing leave_meeting event");
    await this.processEvent(event);
  }

  /**
   * Handle screen share started event
   */
  private async handleShareStarted(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing share_started event");
    await this.processEvent(event);
  }

  /**
   * Handle screen share ended event
   */
  private async handleShareEnded(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing share_ended event");
    await this.processEvent(event);
  }
}
