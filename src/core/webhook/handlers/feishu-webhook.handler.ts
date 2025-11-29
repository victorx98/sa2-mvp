import { Injectable, Logger } from "@nestjs/common";
import { IFeishuWebhookRequest } from "../dto/webhook-event.dto";
import { UnifiedMeetingEventService } from "@core/meeting/services/unified-meeting-event.service";

/**
 * Feishu Webhook Handler (v4.3)
 *
 * Minimal adapter layer that:
 * 1. Receives Feishu webhook payload
 * 2. Passes to UnifiedMeetingEventService for processing
 * 
 * Data Flow (v4.3):
 * Feishu HTTP Request → UnifiedMeetingEventService → Adapter → Store + Lifecycle
 */
@Injectable()
export class FeishuWebhookHandler {
  private readonly logger = new Logger(FeishuWebhookHandler.name);

  constructor(
    private readonly unifiedEventService: UnifiedMeetingEventService,
  ) {}

  /**
   * Handle Feishu webhook event (v4.3)
   * 
   * Simple forwarding to UnifiedMeetingEventService
   * All extraction and processing logic is delegated to the adapter pattern
   * 
   * @param payload - Raw Feishu webhook payload
   */
  async handle(payload: IFeishuWebhookRequest): Promise<void> {
    this.logger.debug(
      `Processing Feishu webhook: ${payload.header?.event_type}`,
    );

    // Forward to unified event service
    await this.unifiedEventService.recordFeishuEvent(payload);

    this.logger.log(
      `Feishu webhook processed: ${payload.header?.event_type}`,
    );
  }
}
