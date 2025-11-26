import { Injectable, Logger } from "@nestjs/common";
import { ZoomEventExtractor } from "../extractors/zoom-event-extractor";
import { IZoomWebhookRequest } from "../dto/webhook-event.dto";
import { MeetingEventService } from "@core/meeting/services/meeting-event.service";

/**
 * Zoom Webhook Handler (v4.0)
 *
 * Minimal adapter layer that:
 * 1. Extracts full event fields from Zoom webhook payload
 * 2. Directly calls MeetingEventService.recordEvent() (v4.0)
 * 
 * No business routing logic - pure protocol adaptation and direct call
 * 
 * Event Flow (v4.0):
 * Zoom HTTP Request → Extract Full Event Data → Call MeetingEventService.recordEvent()
 */
@Injectable()
export class ZoomWebhookHandler {
  private readonly logger = new Logger(ZoomWebhookHandler.name);

  constructor(
    private readonly zoomEventExtractor: ZoomEventExtractor,
    private readonly meetingEventService: MeetingEventService,
  ) {}

  /**
   * Handle Zoom webhook event (v4.0)
   * 
   * Single responsibility:
   * 1. Extract full event fields using extractor
   * 2. Directly call MeetingEventService.recordEvent()
   * 3. Return immediately (no business routing logic)
   * 
   * @param payload - Raw Zoom webhook payload
   */
  async handle(payload: IZoomWebhookRequest): Promise<void> {
    this.logger.debug(`Processing Zoom webhook: ${payload.event}`);

    // 1. Extract full event fields (including meeting_topic, meeting_start_time, meeting_end_time)
    const fullEvent = this.zoomEventExtractor.extractFullEvent(payload);

    // 2. Directly call Meeting Module to record event
    await this.meetingEventService.recordEvent({
      meetingNo: fullEvent.meetingNo || fullEvent.meetingId || "",
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
      `Zoom event recorded: ${fullEvent.eventType} (meeting_id: ${fullEvent.meetingId})`,
    );
  }
}
