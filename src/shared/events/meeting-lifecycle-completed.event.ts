import { IEvent } from "./event.types";

export const MEETING_LIFECYCLE_COMPLETED_EVENT = "meeting.lifecycle.completed";

/**
 * Meeting Time Segment Interface
 * Represents a continuous time period during the meeting
 */
export interface MeetingTimeSegment {
  start: string; // ISO timestamp
  end: string; // ISO timestamp
}

/**
 * Meeting Lifecycle Completed Event Payload
 * 
 * Published when a meeting physically ends (triggered by Webhook)
 * Subscribers: Mentoring, Interview, GapAnalysis, Calendar modules
 * 
 * Note: Meeting cancellation does NOT publish this event.
 * Cancellations are handled synchronously in Application layer.
 */
export interface MeetingLifecycleCompletedPayload {
  // Identity
  meetingId: string; // UUID - Primary key for FK lookups
  meetingNo: string; // Meeting number (Feishu 9-digit)
  
  // Provider info
  provider: string; // 'feishu' | 'zoom'
  
  // Status (for clarity and consistency with DB)
  status: 'ended'; // Fixed value for type safety
  
  // Schedule info
  scheduleStartTime: Date; // Scheduled start time
  scheduleDuration: number; // Scheduled duration (minutes)
  
  // Actual execution info (all required for completed meetings)
  actualDuration: number; // Actual duration in seconds
  endedAt: Date; // Final completion timestamp
  timeList: MeetingTimeSegment[]; // Meeting time segments (for reconnections)
  
  // Recording (optional)
  recordingUrl: string | null; // Recording URL (if available)
}

/**
 * Meeting Lifecycle Completed Event
 * Extends IEvent with typed payload
 */
export interface MeetingLifecycleCompletedEvent 
  extends IEvent<MeetingLifecycleCompletedPayload> {
  type: typeof MEETING_LIFECYCLE_COMPLETED_EVENT;
}

