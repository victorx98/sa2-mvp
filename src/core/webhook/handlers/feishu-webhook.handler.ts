import { Injectable, Logger } from "@nestjs/common";
import { FeishuEventExtractor } from "../extractors/feishu-event-extractor";
import { IFeishuWebhookRequest } from "../dto/webhook-event.dto";
import { MeetingEventService } from "@core/meeting/services/meeting-event.service";

/**
 * Feishu Webhook Handler (v4.0)
 *
 * Minimal adapter layer that:
 * 1. Extracts standard fields from Feishu webhook payload
 * 2. Directly calls MeetingEventService.recordEvent()
 * 
 * No business routing logic - pure protocol adaptation and forwarding
 * 
 * Data Flow (v4.0):
 * Feishu HTTP Request → Extract StandardEventDto → MeetingEventService.recordEvent()
 */
@Injectable()
export class FeishuWebhookHandler {
  private readonly logger = new Logger(FeishuWebhookHandler.name);

  constructor(
    private readonly feishuEventExtractor: FeishuEventExtractor,
    private readonly meetingEventService: MeetingEventService,
  ) {}

  /**
   * Handle Feishu webhook event (v4.0)
   * 
   * Single responsibility:
   * 1. Extract full event fields using extractor
   * 2. Directly call MeetingEventService.recordEvent()
   * 3. Return immediately (no business routing logic)
   * 
   * @param payload - Raw Feishu webhook payload
   */
  async handle(payload: IFeishuWebhookRequest): Promise<void> {
    this.logger.debug(
      `Processing Feishu webhook: ${payload.header?.event_type}`,
    );

    // 1. Extract full event fields (including meeting_topic, meeting_start_time, meeting_end_time)
    const fullEvent = this.feishuEventExtractor.extractFullEvent(payload);

    // 2. Directly call Meeting Module to record event
    await this.meetingEventService.recordEvent({
      meetingNo: fullEvent.meetingNo || "",
      meetingId: fullEvent.meetingId || "",
      eventId: fullEvent.eventId,
      eventType: fullEvent.eventType,
      provider: fullEvent.provider,
      operatorId: fullEvent.operatorId,
      operatorRole: fullEvent.operatorRole,
      meetingTopic: fullEvent.meetingTopic,
      meetingStartTime: fullEvent.meetingStartTime,
      meetingEndTime: fullEvent.meetingEndTime,
      eventData: fullEvent.eventData,
      occurredAt: fullEvent.occurredAt,
    });

    this.logger.log(
      `Feishu event recorded: ${fullEvent.eventType} (meeting_no: ${fullEvent.meetingNo})`,
    );
  }
}
