import { Injectable, Logger } from "@nestjs/common";
import {
  IEventAdapter,
  StandardizedEventData,
  MeetingTimeSegment,
} from "./event-adapter.interface";

/**
 * Zoom Event Adapter
 * 
 * Extracts standardized event data from Zoom webhook events
 * Handles Zoom-specific data structures and field paths
 */
@Injectable()
export class ZoomEventAdapter implements IEventAdapter {
  private readonly logger = new Logger(ZoomEventAdapter.name);

  /**
   * Extract standardized event data from Zoom webhook
   */
  extractStandardEvent(rawEvent: any): StandardizedEventData {
    const payload = rawEvent.payload || {};
    const object = payload.object || {};
    
    const eventType = String(rawEvent.event || "");
    const meetingId = String(object.id || "");

    return {
      meetingId,
      meetingNo: meetingId, // Zoom uses meeting ID as meeting number
      eventId: this.generateEventId(rawEvent),
      eventType,
      provider: "zoom",
      occurredAt: this.extractOccurredAt(rawEvent),
      meetingTopic: object.topic ? String(object.topic) : undefined,
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
   * Zoom path: payload.object.start_time & payload.object.end_time (ISO 8601 strings)
   */
  extractTimeSegment(rawEvent: any): MeetingTimeSegment | null {
    try {
      const object = rawEvent?.payload?.object;
      
      if (!object) {
        return null;
      }

      const startTime = object.start_time;
      const endTime = object.end_time;

      if (!startTime || !endTime) {
        this.logger.warn("Missing start_time or end_time in Zoom meeting.ended event");
        return null;
      }

      // Zoom provides ISO 8601 timestamp strings, parse and re-format
      const startDate = new Date(startTime);
      const endDate = new Date(endTime);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        this.logger.warn(`Invalid timestamp format in Zoom event: start=${startTime}, end=${endTime}`);
        return null;
      }

      return {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Error extracting time segment from Zoom event: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Extract recording URL from recording.completed event
   * Zoom path: payload.object.share_url or payload.object.recording_files[0].play_url
   */
  extractRecordingUrl(rawEvent: any): string | null {
    try {
      const object = rawEvent?.payload?.object;
      
      if (!object) {
        return null;
      }

      // Priority 1: share_url (overall recording URL)
      if (object.share_url) {
        return String(object.share_url);
      }

      // Priority 2: first recording file's play URL
      if (object.recording_files && Array.isArray(object.recording_files)) {
        const firstFile = object.recording_files[0];
        if (firstFile?.play_url) {
          return String(firstFile.play_url);
        }
      }

      this.logger.warn("No recording URL found in Zoom recording.completed event");
      return null;
    } catch (error) {
      this.logger.error(
        `Error extracting recording URL from Zoom event: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Check if event is meeting.started
   */
  isMeetingStarted(eventType: string): boolean {
    return eventType === "meeting.started";
  }

  /**
   * Check if event is meeting.ended
   */
  isMeetingEnded(eventType: string): boolean {
    return eventType === "meeting.ended";
  }

  /**
   * Check if event is recording.completed
   */
  isRecordingCompleted(eventType: string): boolean {
    return eventType === "recording.completed";
  }

  /**
   * Generate unique event ID from Zoom event
   * Uses Zoom's uuid field which uniquely identifies each event occurrence
   */
  private generateEventId(rawEvent: any): string {
    const uuid = rawEvent.payload?.object?.uuid;

    if (!uuid) {
      this.logger.warn("Missing uuid in Zoom event, generating fallback ID");
      const eventTs = rawEvent.event_ts || Date.now();
      const meetingId = rawEvent.payload?.object?.id || 'unknown';
      return `zoom_${meetingId}_${eventTs}`;
    }

    // Zoom's uuid is globally unique for each meeting instance
    return String(uuid);
  }

  /**
   * Extract event occurrence time from Zoom event
   * Zoom provides event_ts in Unix timestamp milliseconds
   */
  private extractOccurredAt(rawEvent: any): Date {
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

    // Zoom event_ts is in milliseconds
    return new Date(timestamp);
  }
}

