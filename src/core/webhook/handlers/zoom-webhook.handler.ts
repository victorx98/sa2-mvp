import { Injectable, Logger } from "@nestjs/common";
import {
  IWebhookHandler,
  IWebhookEvent,
} from "../interfaces/webhook-handler.interface";

/**
 * Zoom Webhook Handler
 *
 * Handles webhook events from Zoom platform
 * TODO: Implement when Zoom integration is needed
 */
@Injectable()
export class ZoomWebhookHandler implements IWebhookHandler {
  private readonly logger = new Logger(ZoomWebhookHandler.name);

  /**
   * Get supported event types
   */
  getSupportedEventTypes(): string[] {
    // TODO: Add Zoom event types when implementing
    return [
      "meeting.started",
      "meeting.ended",
      "recording.completed",
      "participant.joined",
      "participant.left",
    ];
  }

  /**
   * Handle webhook event
   */
  async handleEvent(event: IWebhookEvent): Promise<void> {
    this.logger.warn(
      `Zoom webhook handler not yet implemented. Event type: ${event.eventType}`,
    );

    // TODO: Implement Zoom event handling
    // Similar structure to FeishuWebhookHandler
  }
}
