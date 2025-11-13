import { Injectable, Logger } from "@nestjs/common";
import { IFeishuWebhookRequest } from "../dto/webhook-event.dto";

/**
 * Extracted meeting event data structure
 * Common format for both Feishu and Zoom events
 */
export interface ExtractedMeetingEventData {
  meetingId: string;
  meetingNo: string | null;
  eventId: string;
  eventType: string;
  provider: string; // 'feishu' | 'zoom'
  operatorId: string | null;
  operatorRole: number | null; // 1 = host, 2 = participant
  meetingTopic: string | null;
  meetingStartTime: Date | null;
  meetingEndTime: Date | null;
  recordingId: string | null;
  recordingUrl: string | null;
  occurredAt: Date;
  eventData: Record<string, any>; // Complete raw webhook payload
}

/**
 * Feishu Event Extractor
 *
 * Extracts and normalizes structured fields from Feishu webhook data
 * Handles platform-specific data transformations
 */
@Injectable()
export class FeishuEventExtractor {
  private readonly logger = new Logger(FeishuEventExtractor.name);

  /**
   * Extract all structured fields from Feishu webhook payload
   *
   * @param rawEvent - Raw Feishu webhook event
   * @returns Normalized meeting event data
   */
  extract(rawEvent: IFeishuWebhookRequest): ExtractedMeetingEventData {
    const event = rawEvent.event || {};
    const header = rawEvent.header || {};

    return {
      meetingId: this.extractMeetingId(event),
      meetingNo: this.extractMeetingNo(event),
      eventId: this.extractEventId(header),
      eventType: this.extractEventType(header),
      provider: "feishu",
      operatorId: this.extractOperatorId(event),
      operatorRole: this.extractOperatorRole(event),
      meetingTopic: this.extractMeetingTopic(event),
      meetingStartTime: this.extractMeetingStartTime(event),
      meetingEndTime: this.extractMeetingEndTime(event),
      recordingId: this.extractRecordingId(event),
      recordingUrl: this.extractRecordingUrl(event),
      occurredAt: this.extractOccurredAt(header),
      eventData: rawEvent as any, // Store complete raw payload
    };
  }

  /**
   * Extract meeting_id from event.meeting.id
   *
   * @param data - Event data object
   * @returns Meeting ID or empty string
   */
  private extractMeetingId(data: Record<string, any>): string {
    const meetingId = data?.meeting?.id;
    if (!meetingId) {
      this.logger.warn("Missing meeting.id in Feishu event");
      return "";
    }
    return String(meetingId);
  }

  /**
   * Extract meeting_no (Feishu 9-digit meeting number)
   *
   * @param data - Event data object
   * @returns Meeting number or null
   */
  private extractMeetingNo(data: Record<string, any>): string | null {
    const meetingNo = data?.meeting?.meeting_no;
    return meetingNo ? String(meetingNo) : null;
  }

  /**
   * Extract event_id (unique identifier for deduplication)
   *
   * @param header - Event header
   * @returns Event ID
   */
  private extractEventId(header: Record<string, any>): string {
    const eventId = header?.event_id;
    if (!eventId) {
      this.logger.warn("Missing header.event_id in Feishu event");
      return "";
    }
    return String(eventId);
  }

  /**
   * Extract event_type from header
   *
   * @param header - Event header
   * @returns Event type
   */
  private extractEventType(header: Record<string, any>): string {
    const eventType = header?.event_type;
    if (!eventType) {
      this.logger.warn("Missing header.event_type in Feishu event");
      return "";
    }
    return String(eventType);
  }

  /**
   * Extract operator_id (user performing the action)
   * Priority: user_id > open_id
   *
   * @param data - Event data object
   * @returns Operator ID or null
   */
  private extractOperatorId(data: Record<string, any>): string | null {
    const operator = data?.operator;
    if (!operator) return null;

    // Try user_id first
    const userId = operator.id?.user_id;
    if (userId) return String(userId);

    // Fall back to open_id
    const openId = operator.id?.open_id;
    if (openId) return String(openId);

    return null;
  }

  /**
   * Extract operator_role
   * 1 = host, 2 = participant
   *
   * @param data - Event data object
   * @returns Operator role (1, 2) or null
   */
  private extractOperatorRole(data: Record<string, any>): number | null {
    const role = data?.operator?.user_role;
    if (role === undefined || role === null) return null;
    return Number(role);
  }

  /**
   * Extract meeting topic/title
   *
   * @param data - Event data object
   * @returns Meeting topic or null
   */
  private extractMeetingTopic(data: Record<string, any>): string | null {
    const topic = data?.meeting?.topic;
    return topic ? String(topic) : null;
  }

  /**
   * Extract meeting start time (Unix seconds to Date)
   *
   * @param data - Event data object
   * @returns Start time or null
   */
  private extractMeetingStartTime(data: Record<string, any>): Date | null {
    const startTime = data?.meeting?.start_time;
    if (!startTime) return null;

    // Feishu provides Unix timestamp in seconds
    const timestamp = Number(startTime);
    if (isNaN(timestamp)) return null;

    return new Date(timestamp * 1000);
  }

  /**
   * Extract meeting end time (Unix seconds to Date)
   *
   * @param data - Event data object
   * @returns End time or null
   */
  private extractMeetingEndTime(data: Record<string, any>): Date | null {
    const endTime = data?.meeting?.end_time;
    if (!endTime) return null;

    // Feishu provides Unix timestamp in seconds
    const timestamp = Number(endTime);
    if (isNaN(timestamp)) return null;

    return new Date(timestamp * 1000);
  }

  /**
   * Extract recording_id from event data
   *
   * @param data - Event data object
   * @returns Recording ID or null
   */
  private extractRecordingId(data: Record<string, any>): string | null {
    const recordingId = data?.recording?.id;
    return recordingId ? String(recordingId) : null;
  }

  /**
   * Extract recording_url from event data
   *
   * @param data - Event data object
   * @returns Recording URL or null
   */
  private extractRecordingUrl(data: Record<string, any>): string | null {
    const recordingUrl = data?.recording?.url;
    return recordingUrl ? String(recordingUrl) : null;
  }

  /**
   * Extract event occurrence time (milliseconds to seconds to Date)
   * Feishu provides create_time in milliseconds
   *
   * @param header - Event header
   * @returns Event occurrence time
   */
  private extractOccurredAt(header: Record<string, any>): Date {
    const createTime = header?.create_time;

    if (!createTime) {
      this.logger.warn("Missing header.create_time in Feishu event");
      return new Date();
    }

    // Feishu provides timestamp in milliseconds as string
    const timestamp = Number(createTime);
    if (isNaN(timestamp)) {
      this.logger.warn(
        `Invalid create_time format: ${createTime}, using current time`,
      );
      return new Date();
    }

    // If value looks like milliseconds (> 10^10), use directly
    // Otherwise assume seconds and multiply by 1000
    const msTimestamp = timestamp > 10000000000 ? timestamp : timestamp * 1000;
    return new Date(msTimestamp);
  }
}

