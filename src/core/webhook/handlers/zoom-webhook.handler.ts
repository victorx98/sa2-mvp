import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ZoomEventExtractor } from "../extractors/zoom-event-extractor";
import { IZoomWebhookRequest } from "../dto/webhook-event.dto";
import { StandardEventDto } from "../dto/webhook-event.dto";

/**
 * Zoom Webhook Handler
 *
 * Minimal adapter layer that:
 * 1. Extracts standard fields from Zoom webhook payload
 * 2. Emits event for subscribers (Core Meeting Module, other domains)
 * 
 * No business routing logic - pure protocol adaptation and event forwarding
 * 
 * Event Flow:
 * Zoom HTTP Request → Extract StandardEventDto → Emit 'webhook.zoom.event' → Subscribers
 */
@Injectable()
export class ZoomWebhookHandler {
  private readonly logger = new Logger(ZoomWebhookHandler.name);

  constructor(
    private readonly zoomEventExtractor: ZoomEventExtractor,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle Zoom webhook event
   * 
   * Single responsibility:
   * 1. Extract standard fields using extractor
   * 2. Emit event for downstream subscribers
   * 3. Return immediately (no business logic here)
   * 
   * @param payload - Raw Zoom webhook payload
   */
  async handle(payload: IZoomWebhookRequest): Promise<void> {
    this.logger.debug(`Processing Zoom webhook: ${payload.event}`);

    // 1. Extract standard event fields (meeting_no, event_type, provider, etc.)
    const standardEvent = this.zoomEventExtractor.extractStandardEvent(payload);

    // 2. Emit event for subscribers
    // Event name format: "webhook.{provider}.event"
    // Subscribers can filter by provider and event type
    this.eventEmitter.emit("webhook.zoom.event", standardEvent);

    this.logger.log(
      `Zoom event emitted: ${standardEvent.eventType} (meeting_id: ${standardEvent.meetingId})`,
    );
  }
}
