import { Injectable, Logger } from "@nestjs/common";
import { IZoomWebhookRequest, StandardEventDto } from "../dto/webhook-event.dto";
import { ExtractedMeetingEventData } from "./feishu-event-extractor";

/**
 * Zoom Event Extractor
 *
 * Extracts and normalizes fields from Zoom webhook data
 * Provides two extraction methods:
 * 1. extractStandardEvent() - Minimal fields needed for event forwarding (v4.0 primary)
 * 2. extractFullEvent() - Extended fields for subscribers that need detailed information
 */
@Injectable()
export class ZoomEventExtractor {
  private readonly logger = new Logger(ZoomEventExtractor.name);

  /**
   * Extract standard event DTO from Zoom webhook payload (v4.0)
   * 
   * Extracts only essential fields required for event forwarding:
   * - meetingNo, meetingId, eventId, eventType, provider, occurredAt, operatorId
   *
   * @param rawEvent - Raw Zoom webhook event
   * @returns StandardEventDto ready for MeetingEventService
   */
  extractStandardEvent(rawEvent: IZoomWebhookRequest): StandardEventDto {
    const payload = (rawEvent.payload || {}) as Record<string, any>;
    const object = (payload.object || {}) as Record<string, any>;

    return {
      meetingNo: this.extractMeetingId(object), // Zoom uses meeting ID as meeting number
      meetingId: this.extractMeetingId(object),
      eventId: this.extractEventId(rawEvent), // v4.0: Required for deduplication
      eventType: this.extractEventType(rawEvent),
      provider: "zoom",
      eventData: rawEvent as any,
      occurredAt: this.extractOccurredAt(rawEvent),
      operatorId: this.extractOperatorId(object) || undefined,
    };
  }

  /**
   * Extract full event data with all available fields
   * 
   * Extracts comprehensive fields for subscribers that need detailed information
   * Useful for audit logging, detailed processing, or complex business logic
   *
   * @param rawEvent - Raw Zoom webhook event
   * @returns ExtractedMeetingEventData with complete field set
   */
  extractFullEvent(rawEvent: IZoomWebhookRequest): ExtractedMeetingEventData {
    const payload = (rawEvent.payload || {}) as Record<string, any>;
    const object = (payload.object || {}) as Record<string, any>;

    return {
      meetingId: this.extractMeetingId(object),
      meetingNo: null, // Zoom doesn't have meeting_no, using meetingId instead
      eventId: this.extractEventId(rawEvent),
      eventType: this.extractEventType(rawEvent),
      provider: "zoom",
      operatorId: this.extractOperatorId(object),
      operatorRole: null, // Zoom doesn't provide role in webhook
      meetingTopic: this.extractMeetingTopic(object),
      meetingStartTime: this.extractMeetingStartTime(object),
      meetingEndTime: this.extractMeetingEndTime(object),
      recordingId: null, // Extracted from recording.completed event
      recordingUrl: null, // Extracted from recording.completed event
      occurredAt: this.extractOccurredAt(rawEvent),
      eventData: rawEvent as any,
    };
  }

  /**
   * Extract meeting_id from payload.object.id
   */
  private extractMeetingId(object: Record<string, any>): string {
    const meetingId = object?.id;
    if (!meetingId) {
      this.logger.warn("Missing payload.object.id in Zoom event");
      return "";
    }
    return String(meetingId);
  }

  /**
   * Generate unique event_id from event_ts + meeting_id
   * Ensures idempotency for the same event
   */
  private extractEventId(rawEvent: IZoomWebhookRequest): string {
    const eventTs = rawEvent.event_ts;
    const meetingId = rawEvent.payload?.object?.id;

    if (!eventTs || !meetingId) {
      this.logger.warn(
        "Missing event_ts or meeting_id for Zoom event ID generation",
      );
      return "";
    }

    return `${meetingId}_${eventTs}`;
  }

  /**
   * Extract event_type from root event field
   */
  private extractEventType(rawEvent: IZoomWebhookRequest): string {
    const eventType = rawEvent.event;
    if (!eventType) {
      this.logger.warn("Missing event type in Zoom webhook");
      return "";
    }
    return String(eventType);
  }

  /**
   * Extract operator_id (host_id in Zoom)
   */
  private extractOperatorId(object: Record<string, any>): string | null {
    const hostId = object?.host_id;
    return hostId ? String(hostId) : null;
  }

  /**
   * Extract meeting topic/title
   */
  private extractMeetingTopic(object: Record<string, any>): string | null {
    const topic = object?.topic;
    return topic ? String(topic) : null;
  }

  /**
   * Extract meeting start time (ISO 8601 to Date)
   */
  private extractMeetingStartTime(object: Record<string, any>): Date | null {
    const startTime = object?.start_time;
    if (!startTime) return null;

    try {
      return new Date(startTime);
    } catch (error) {
      this.logger.warn(`Invalid start_time format: ${startTime}`);
      return null;
    }
  }

  /**
   * Extract meeting end time (ISO 8601 to Date)
   */
  private extractMeetingEndTime(object: Record<string, any>): Date | null {
    const endTime = object?.end_time;
    if (!endTime) return null;

    try {
      return new Date(endTime);
    } catch (error) {
      this.logger.warn(`Invalid end_time format: ${endTime}`);
      return null;
    }
  }

  /**
   * Extract event occurrence time
   * Zoom provides event_ts in Unix timestamp (seconds)
   */
  private extractOccurredAt(rawEvent: IZoomWebhookRequest): Date {
    const eventTs = rawEvent.event_ts;

    if (!eventTs) {
      this.logger.warn("Missing event_ts in Zoom event");
      return new Date();
    }

    const timestamp = Number(eventTs);
    if (isNaN(timestamp)) {
      this.logger.warn(
        `Invalid event_ts format: ${eventTs}, using current time`,
      );
      return new Date();
    }

    return new Date(timestamp * 1000);
  }
}
