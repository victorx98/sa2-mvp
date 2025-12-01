import { Injectable, Logger } from "@nestjs/common";
import { IZoomWebhookRequest } from "../dto/webhook-event.dto";
import { UnifiedMeetingEventService } from "@core/meeting/services/unified-meeting-event.service";

/**
 * Zoom Webhook Handler (v4.3)
 *
 * Minimal adapter layer that:
 * 1. Receives Zoom webhook payload
 * 2. Passes to UnifiedMeetingEventService for processing
 * 
 * Data Flow (v4.3):
 * Zoom HTTP Request → UnifiedMeetingEventService → Adapter → Store + Lifecycle
 */
@Injectable()
export class ZoomWebhookHandler {
  private readonly logger = new Logger(ZoomWebhookHandler.name);

  constructor(
    private readonly unifiedEventService: UnifiedMeetingEventService,
  ) {}

  /**
   * Handle Zoom webhook event (v4.3)
   * 
   * Simple forwarding to UnifiedMeetingEventService
   * All extraction and processing logic is delegated to the adapter pattern
   * 
   * @param payload - Raw Zoom webhook payload
   */
  async handle(payload: IZoomWebhookRequest): Promise<void> {
    this.logger.debug(
      `Processing Zoom webhook: ${payload.event}`,
    );

    // Forward to unified event service
    await this.unifiedEventService.recordZoomEvent(payload);

    this.logger.log(
      `Zoom webhook processed: ${payload.event}`,
    );
  }
}
