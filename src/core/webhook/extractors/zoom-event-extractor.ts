import { Injectable, Logger } from "@nestjs/common";
import { IZoomWebhookRequest } from "../dto/webhook-event.dto";
import { ExtractedMeetingEventData } from "./feishu-event-extractor";

/**
 * Zoom Event Extractor
 *
 * Extracts and normalizes structured fields from Zoom webhook data
 * Converts Zoom-specific format to common ExtractedMeetingEventData
 */
@Injectable()
export class ZoomEventExtractor {
  private readonly logger = new Logger(ZoomEventExtractor.name);

  /**
   * Extract all structured fields from Zoom webhook payload
   *
   * @param rawEvent - Raw Zoom webhook event
   * @returns Normalized meeting event data
   */
  extract(rawEvent: IZoomWebhookRequest): ExtractedMeetingEventData {
    const payload = (rawEvent.payload || {}) as Record<string, any>;
    const object = (payload.object || {}) as Record<string, any>;

    return {
      meetingId: this.extractMeetingId(object),
      meetingNo: null, // Zoom doesn't have a meeting_no equivalent, using meetingId
      eventId: this.extractEventId(rawEvent),
      eventType: this.extractEventType(rawEvent),
      provider: "zoom",
      operatorId: this.extractOperatorId(object),
      operatorRole: null, // Zoom doesn't provide role in webhook
      meetingTopic: this.extractMeetingTopic(object),
      meetingStartTime: this.extractMeetingStartTime(object),
      meetingEndTime: this.extractMeetingEndTime(object),
      recordingId: null, // Will be extracted from recording.completed event
      recordingUrl: null, // Will be extracted from recording.completed event
      occurredAt: this.extractOccurredAt(rawEvent),
      eventData: rawEvent as any, // Store complete raw payload
    };
  }

  /**
   * Extract meeting_id from payload.object.id
   *
   * @param object - Object containing meeting info
   * @returns Meeting ID or empty string
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
   *
   * @param rawEvent - Raw Zoom webhook event
   * @returns Generated event ID
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

    // Combine timestamp and meeting ID to create unique event identifier
    return `${meetingId}_${eventTs}`;
  }

  /**
   * Extract event_type from root event field
   *
   * @param rawEvent - Raw Zoom webhook event
   * @returns Event type
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
   *
   * @param object - Object containing meeting info
   * @returns Operator ID or null
   */
  private extractOperatorId(object: Record<string, any>): string | null {
    const hostId = object?.host_id;
    return hostId ? String(hostId) : null;
  }

  /**
   * Extract meeting topic/title
   *
   * @param object - Object containing meeting info
   * @returns Meeting topic or null
   */
  private extractMeetingTopic(object: Record<string, any>): string | null {
    const topic = object?.topic;
    return topic ? String(topic) : null;
  }

  /**
   * Extract meeting start time (ISO 8601 to Date)
   *
   * @param object - Object containing meeting info
   * @returns Start time or null
   */
  private extractMeetingStartTime(object: Record<string, any>): Date | null {
    const startTime = object?.start_time;
    if (!startTime) return null;

    try {
      // Zoom provides ISO 8601 format string
      return new Date(startTime);
    } catch (error) {
      this.logger.warn(`Invalid start_time format: ${startTime}`);
      return null;
    }
  }

  /**
   * Extract meeting end time (ISO 8601 to Date)
   *
   * @param object - Object containing meeting info
   * @returns End time or null
   */
  private extractMeetingEndTime(object: Record<string, any>): Date | null {
    const endTime = object?.end_time;
    if (!endTime) return null;

    try {
      // Zoom provides ISO 8601 format string
      return new Date(endTime);
    } catch (error) {
      this.logger.warn(`Invalid end_time format: ${endTime}`);
      return null;
    }
  }

  /**
   * Extract event occurrence time (Unix seconds to Date)
   * Zoom provides event_ts in Unix timestamp (seconds)
   *
   * @param rawEvent - Raw Zoom webhook event
   * @returns Event occurrence time
   */
  private extractOccurredAt(rawEvent: IZoomWebhookRequest): Date {
    const eventTs = rawEvent.event_ts;

    if (!eventTs) {
      this.logger.warn("Missing event_ts in Zoom event");
      return new Date();
    }

    // Zoom provides Unix timestamp in seconds
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

