import { Injectable, Logger } from "@nestjs/common";
import {
  IWebhookHandler,
  IWebhookEvent,
} from "../interfaces/webhook-handler.interface";
import { WebhookProcessingException } from "../exceptions/webhook.exception";
import { ZoomEventExtractor } from "../extractors/zoom-event-extractor";
import { MeetingEventService } from "@core/meeting-providers/services/meeting-event.service";
import { WebhookEventBusService } from "../services/webhook-event-bus.service";
import { MeetingEventCreated } from "../dto/meeting-event-created.event";

/**
 * Zoom Event Types
 */
export enum ZoomEventType {
  MEETING_STARTED = "meeting.started",
  MEETING_ENDED = "meeting.ended",
  MEETING_PARTICIPANT_JOINED = "meeting.participant_joined",
  MEETING_PARTICIPANT_LEFT = "meeting.participant_left",
  RECORDING_COMPLETED = "recording.completed",
}

/**
 * Zoom Webhook Handler
 *
 * Handles webhook events from Zoom platform
 * Flow: Extract → Store → Publish domain event
 */
@Injectable()
export class ZoomWebhookHandler implements IWebhookHandler {
  private readonly logger = new Logger(ZoomWebhookHandler.name);

  constructor(
    private readonly zoomEventExtractor: ZoomEventExtractor,
    private readonly meetingEventService: MeetingEventService,
    private readonly eventBus: WebhookEventBusService,
  ) {}

  /**
   * Get supported event types
   */
  getSupportedEventTypes(): string[] {
    return Object.values(ZoomEventType);
  }

  /**
   * Handle webhook event
   */
  async handleEvent(event: IWebhookEvent): Promise<void> {
    this.logger.debug(`Handling Zoom event: ${event.eventType}`);

    try {
      switch (event.eventType) {
        case ZoomEventType.MEETING_STARTED:
          await this.handleMeetingStarted(event);
          break;

        case ZoomEventType.MEETING_ENDED:
          await this.handleMeetingEnded(event);
          break;

        case ZoomEventType.MEETING_PARTICIPANT_JOINED:
          await this.handleParticipantJoined(event);
          break;

        case ZoomEventType.MEETING_PARTICIPANT_LEFT:
          await this.handleParticipantLeft(event);
          break;

        case ZoomEventType.RECORDING_COMPLETED:
          await this.handleRecordingCompleted(event);
          break;

        default:
          this.logger.warn(`Unsupported Zoom event type: ${event.eventType}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to handle Zoom event ${event.eventType}: ${message}`,
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
    const extractedData = this.zoomEventExtractor.extract(
      rawEvent.eventData as any,
    );

    this.logger.debug(
      `Extracted event: ${extractedData.eventType} (${extractedData.eventId})`,
    );

    // 2. Store event in meeting_events table (with automatic deduplication)
    await this.meetingEventService.recordEvent(extractedData);

    // 3. Publish domain event for subscribers (Session Domain, Comm Session, etc.)
    const domainEvent = new MeetingEventCreated(
      extractedData.meetingId,
      extractedData.meetingNo,
      extractedData.eventId,
      extractedData.eventType,
      extractedData.provider,
      extractedData.operatorId,
      extractedData.operatorRole,
      extractedData.meetingTopic,
      extractedData.occurredAt,
      extractedData.eventData,
    );

    await this.eventBus.publish(domainEvent);

    this.logger.log(
      `Event processed and published: ${extractedData.eventType}`,
    );
  }

  /**
   * Handle meeting started event
   */
  private async handleMeetingStarted(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing meeting.started event");
    await this.processEvent(event);
  }

  /**
   * Handle meeting ended event
   */
  private async handleMeetingEnded(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing meeting.ended event");
    await this.processEvent(event);
  }

  /**
   * Handle participant joined event
   */
  private async handleParticipantJoined(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing meeting.participant_joined event");
    await this.processEvent(event);
  }

  /**
   * Handle participant left event
   */
  private async handleParticipantLeft(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing meeting.participant_left event");
    await this.processEvent(event);
  }

  /**
   * Handle recording completed event
   */
  private async handleRecordingCompleted(event: IWebhookEvent): Promise<void> {
    this.logger.debug("Processing recording.completed event");
    await this.processEvent(event);
  }
}
