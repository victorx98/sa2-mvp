import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { FeishuEventExtractor } from "../extractors/feishu-event-extractor";
import { IFeishuWebhookRequest } from "../dto/webhook-event.dto";
import { StandardEventDto } from "../dto/webhook-event.dto";

/**
 * Feishu Webhook Handler
 *
 * Minimal adapter layer that:
 * 1. Extracts standard fields from Feishu webhook payload
 * 2. Emits event for subscribers (Core Meeting Module, other domains)
 * 
 * No business routing logic - pure protocol adaptation and event forwarding
 * 
 * Event Flow:
 * Feishu HTTP Request → Extract StandardEventDto → Emit 'webhook.feishu.event' → Subscribers
 */
@Injectable()
export class FeishuWebhookHandler {
  private readonly logger = new Logger(FeishuWebhookHandler.name);

  constructor(
    private readonly feishuEventExtractor: FeishuEventExtractor,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle Feishu webhook event
   * 
   * Single responsibility:
   * 1. Extract standard fields using extractor
   * 2. Emit event for downstream subscribers
   * 3. Return immediately (no business logic here)
   * 
   * @param payload - Raw Feishu webhook payload
   */
  async handle(payload: IFeishuWebhookRequest): Promise<void> {
    this.logger.debug(
      `Processing Feishu webhook: ${payload.header?.event_type}`,
    );

    // 1. Extract standard event fields (meeting_no, event_type, provider, etc.)
    const standardEvent = this.feishuEventExtractor.extractStandardEvent(payload);

    // 2. Emit event for subscribers
    // Event name format: "webhook.{provider}.event"
    // Subscribers can filter by provider and event type
    this.eventEmitter.emit("webhook.feishu.event", standardEvent);

    this.logger.log(
      `Feishu event emitted: ${standardEvent.eventType} (meeting_no: ${standardEvent.meetingNo})`,
    );
  }
}
