/**
 * Event Adapter Interface
 * 
 * Unified interface for extracting meeting event data from different providers
 * Isolates provider-specific differences in a clean abstraction layer
 * 
 * Design principles:
 * - Each provider implements this interface with their specific extraction logic
 * - Business logic works with standardized output regardless of provider
 * - Easy to add new providers by implementing this interface
 */

/**
 * Standardized meeting time segment
 */
export interface MeetingTimeSegment {
  start: string; // ISO 8601 timestamp
  end: string;   // ISO 8601 timestamp
}

/**
 * Standardized event data extracted from provider-specific webhooks
 */
export interface StandardizedEventData {
  // Meeting identification
  meetingId: string;
  meetingNo: string;
  
  // Event identification
  eventId: string;
  eventType: string;
  
  // Provider info
  provider: 'feishu' | 'zoom';
  
  // Time information
  occurredAt: Date;
  
  // Optional: meeting topic
  meetingTopic?: string;
  
  // Optional: time segment (for meeting.ended events)
  timeSegment?: MeetingTimeSegment;
  
  // Optional: recording URL (for recording.completed events)
  recordingUrl?: string;
  
  // Complete raw event data
  rawEventData: any;
}

/**
 * Event Adapter Interface
 * 
 * Defines methods for extracting standardized data from provider-specific events
 */
export interface IEventAdapter {
  /**
   * Extract standardized event data from raw provider event
   * 
   * @param rawEvent - Raw webhook event from provider
   * @returns Standardized event data
   */
  extractStandardEvent(rawEvent: any): StandardizedEventData;
  
  /**
   * Extract meeting time segment from meeting.ended event
   * Returns null if not a meeting.ended event or extraction fails
   * 
   * @param rawEvent - Raw webhook event
   * @returns Time segment or null
   */
  extractTimeSegment(rawEvent: any): MeetingTimeSegment | null;
  
  /**
   * Extract recording URL from recording.completed event
   * Returns null if not a recording event or extraction fails
   * 
   * @param rawEvent - Raw webhook event
   * @returns Recording URL or null
   */
  extractRecordingUrl(rawEvent: any): string | null;
  
  /**
   * Check if event type is meeting.started
   * 
   * @param eventType - Event type string
   * @returns True if meeting started event
   */
  isMeetingStarted(eventType: string): boolean;
  
  /**
   * Check if event type is meeting.ended
   * 
   * @param eventType - Event type string
   * @returns True if meeting ended event
   */
  isMeetingEnded(eventType: string): boolean;
  
  /**
   * Check if event type is recording.completed
   * 
   * @param eventType - Event type string
   * @returns True if recording completed event
   */
  isRecordingCompleted(eventType: string): boolean;
}

