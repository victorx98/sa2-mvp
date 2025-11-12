import { ExtractedMeetingEventData } from "../extractors/feishu-event-extractor";

/**
 * Meeting Event Service Interface
 *
 * Defines contract for storing and managing meeting events
 * Implementations should handle deduplication and event persistence
 */
export interface IMeetingEventService {
  /**
   * Find event by event_id for deduplication check
   *
   * @param eventId - Event ID to search for
   * @returns Event data if found, null otherwise
   */
  findByEventId(eventId: string): Promise<any | null>;

  /**
   * Record a new meeting event
   *
   * @param eventData - Extracted event data
   * @returns Created event record
   */
  recordEvent(eventData: ExtractedMeetingEventData): Promise<any>;

  /**
   * Find events by meeting number
   *
   * @param meetingNo - Feishu meeting number
   * @returns Array of events matching the meeting number
   */
  findByMeetingNo(meetingNo: string): Promise<any[]>;

  /**
   * Find events by meeting ID
   *
   * @param meetingId - Meeting ID (platform-specific)
   * @returns Array of events matching the meeting ID
   */
  findByMeetingId(meetingId: string): Promise<any[]>;
}

