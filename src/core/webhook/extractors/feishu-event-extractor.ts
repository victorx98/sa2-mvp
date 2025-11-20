import { Injectable, Logger } from "@nestjs/common";
import { IFeishuWebhookRequest, StandardEventDto } from "../dto/webhook-event.dto";

/**
 * Extended meeting event data structure
 * 
 * This interface is kept for potential future use by other modules
 * but Webhook module primarily uses StandardEventDto for all forwarding
 */
export interface ExtractedMeetingEventData {
  meetingId: string;
  meetingNo: string | null;
  eventId: string;
  eventType: string;
  provider: string;
  operatorId: string | null;
  operatorRole: number | null;
  meetingTopic: string | null;
  meetingStartTime: Date | null;
  meetingEndTime: Date | null;
  recordingId: string | null;
  recordingUrl: string | null;
  occurredAt: Date;
  eventData: Record<string, any>;
}

/**
 * Feishu Event Extractor
 *
 * Extracts and normalizes fields from Feishu webhook data
 * Provides two extraction methods:
 * 1. extractStandardEvent() - Minimal fields needed for event forwarding (v4.0 primary)
 * 2. extractFullEvent() - Extended fields for subscribers that need detailed information
 */
@Injectable()
export class FeishuEventExtractor {
  private readonly logger = new Logger(FeishuEventExtractor.name);

  /**
   * Extract standard event DTO from Feishu webhook payload
   * 
   * Extracts only essential fields required for event forwarding:
   * - meetingNo, meetingId, eventType, provider, occurredAt, operatorId
   *
   * @param rawEvent - Raw Feishu webhook event
   * @returns StandardEventDto ready for event bus
   */
  extractStandardEvent(rawEvent: IFeishuWebhookRequest): StandardEventDto {
    const event = rawEvent.event || {};
    const header = rawEvent.header || {};

    return {
      meetingNo: this.extractMeetingNo(event) || "",
      meetingId: this.extractMeetingId(event),
      eventType: this.extractEventType(header),
      provider: "feishu",
      eventData: rawEvent as any,
      occurredAt: this.extractOccurredAt(header),
      operatorId: this.extractOperatorId(event) || undefined,
    };
  }

  /**
   * Extract full event data with all available fields
   * 
   * Extracts comprehensive fields for subscribers that need detailed information
   * Useful for audit logging, detailed processing, or complex business logic
   *
   * @param rawEvent - Raw Feishu webhook event
   * @returns ExtractedMeetingEventData with complete field set
   */
  extractFullEvent(rawEvent: IFeishuWebhookRequest): ExtractedMeetingEventData {
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
      eventData: rawEvent as any,
    };
  }

  /**
   * Extract meeting_id from event.meeting.id
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
   */
  private extractMeetingNo(data: Record<string, any>): string | null {
    const meetingNo = data?.meeting?.meeting_no;
    return meetingNo ? String(meetingNo) : null;
  }

  /**
   * Extract event_id (unique identifier for deduplication)
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
   */
  private extractOperatorId(data: Record<string, any>): string | null {
    const operator = data?.operator;
    if (!operator) return null;

    const userId = operator.id?.user_id;
    if (userId) return String(userId);

    const openId = operator.id?.open_id;
    if (openId) return String(openId);

    return null;
  }

  /**
   * Extract operator_role (1 = host, 2 = participant)
   */
  private extractOperatorRole(data: Record<string, any>): number | null {
    const role = data?.operator?.user_role;
    if (role === undefined || role === null) return null;
    return Number(role);
  }

  /**
   * Extract meeting topic/title
   */
  private extractMeetingTopic(data: Record<string, any>): string | null {
    const topic = data?.meeting?.topic;
    return topic ? String(topic) : null;
  }

  /**
   * Extract meeting start time (Unix seconds to Date)
   */
  private extractMeetingStartTime(data: Record<string, any>): Date | null {
    const startTime = data?.meeting?.start_time;
    if (!startTime) return null;

    const timestamp = Number(startTime);
    if (isNaN(timestamp)) return null;

    return new Date(timestamp * 1000);
  }

  /**
   * Extract meeting end time (Unix seconds to Date)
   */
  private extractMeetingEndTime(data: Record<string, any>): Date | null {
    const endTime = data?.meeting?.end_time;
    if (!endTime) return null;

    const timestamp = Number(endTime);
    if (isNaN(timestamp)) return null;

    return new Date(timestamp * 1000);
  }

  /**
   * Extract recording_id from event data
   */
  private extractRecordingId(data: Record<string, any>): string | null {
    const recordingId = data?.recording?.id;
    return recordingId ? String(recordingId) : null;
  }

  /**
   * Extract recording_url from event data
   */
  private extractRecordingUrl(data: Record<string, any>): string | null {
    const recordingUrl = data?.recording?.url;
    return recordingUrl ? String(recordingUrl) : null;
  }

  /**
   * Extract event occurrence time
   * Feishu provides create_time in milliseconds
   */
  private extractOccurredAt(header: Record<string, any>): Date {
    const createTime = header?.create_time;

    if (!createTime) {
      this.logger.warn("Missing header.create_time in Feishu event");
      return new Date();
    }

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
