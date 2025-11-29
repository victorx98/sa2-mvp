import { Injectable, Logger } from "@nestjs/common";
import {
  IEventAdapter,
  StandardizedEventData,
  MeetingTimeSegment,
} from "./event-adapter.interface";

/**
 * Feishu Event Adapter
 * 
 * Extracts standardized event data from Feishu webhook events
 * Handles Feishu-specific data structures and field paths
 */
@Injectable()
export class FeishuEventAdapter implements IEventAdapter {
  private readonly logger = new Logger(FeishuEventAdapter.name);

  /**
   * Extract standardized event data from Feishu webhook
   */
  extractStandardEvent(rawEvent: any): StandardizedEventData {
    const event = rawEvent.event || {};
    const header = rawEvent.header || {};
    const meeting = event.meeting || {};

    const eventType = String(header.event_type || "");
    
    return {
      meetingId: String(meeting.id || ""),
      meetingNo: String(meeting.meeting_no || ""),
      eventId: String(header.event_id || ""),
      eventType,
      provider: "feishu",
      occurredAt: this.extractOccurredAt(header),
      meetingTopic: meeting.topic ? String(meeting.topic) : undefined,
      timeSegment: this.isMeetingEnded(eventType)
        ? this.extractTimeSegment(rawEvent)
        : undefined,
      recordingUrl: this.isRecordingCompleted(eventType)
        ? this.extractRecordingUrl(rawEvent)
        : undefined,
      rawEventData: rawEvent,
    };
  }

  /**
   * Extract time segment from meeting.ended event
   * Feishu path: event.meeting.start_time & event.meeting.end_time (Unix seconds)
   */
  extractTimeSegment(rawEvent: any): MeetingTimeSegment | null {
    try {
      const meeting = rawEvent?.event?.meeting;
      
      if (!meeting) {
        return null;
      }

      const startTime = meeting.start_time;
      const endTime = meeting.end_time;

      if (!startTime || !endTime) {
        this.logger.warn("Missing start_time or end_time in Feishu meeting.ended event");
        return null;
      }

      // Feishu uses Unix timestamps in seconds
      const startDate = new Date(Number(startTime) * 1000);
      const endDate = new Date(Number(endTime) * 1000);

      return {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Error extracting time segment from Feishu event: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Extract recording URL from recording.ready event
   * Feishu path: event.recording.url
   */
  extractRecordingUrl(rawEvent: any): string | null {
    try {
      const recording = rawEvent?.event?.recording;
      
      if (!recording || !recording.url) {
        return null;
      }

      return String(recording.url);
    } catch (error) {
      this.logger.error(
        `Error extracting recording URL from Feishu event: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Check if event is meeting.started
   */
  isMeetingStarted(eventType: string): boolean {
    return eventType === "vc.meeting.meeting_started_v1";
  }

  /**
   * Check if event is meeting.ended
   */
  isMeetingEnded(eventType: string): boolean {
    return eventType === "vc.meeting.meeting_ended_v1";
  }

  /**
   * Check if event is recording.completed
   */
  isRecordingCompleted(eventType: string): boolean {
    return eventType === "vc.meeting.recording_ready_v1";
  }

  /**
   * Extract event occurrence time from Feishu header
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

