/**
 * Meeting Entity
 *
 * Core aggregate root for meeting resource
 * Represents the physical meeting lifecycle and state
 */

export enum MeetingStatus {
  SCHEDULED = "scheduled", // Meeting is created and scheduled
  ACTIVE = "active", // Meeting has started (first join event received)
  ENDED = "ended", // Meeting has ended and finalized
  CANCELLED = "cancelled", // Meeting was cancelled (v4.1)
}

export interface MeetingTimeSegment {
  start: Date; // Segment start time
  end: Date; // Segment end time
}

export interface MeetingEntity {
  id: string; // UUID primary key
  meetingNo: string; // Meeting number (Feishu 9-digit, Zoom number)
  meetingProvider: string; // 'feishu' | 'zoom'
  reserveId: string; // Reserve ID (Feishu reserve_id, Zoom meeting_id) - v4.1
  topic: string; // Meeting topic/title
  meetingUrl: string; // Meeting join URL
  ownerId: string | null; // Meeting owner ID (usually mentor) - v4.1
  scheduleStartTime: Date; // Scheduled start time
  scheduleDuration: number; // Scheduled duration in minutes
  status: MeetingStatus; // Current lifecycle status
  actualDuration: number | null; // Actual duration in seconds (calculated after completion)
  meetingTimeList: MeetingTimeSegment[]; // Array of meeting time segments
  recordingUrl: string | null; // Recording URL (if available)
  lastMeetingEndedTimestamp: Date | null; // Last meeting.ended event timestamp (for delayed detection)
  pendingTaskId: string | null; // Pending delayed task ID (for cancellation)
  eventType: string | null; // Last event type processed
  createdAt: Date; // Record creation time
  updatedAt: Date; // Record last update time
}

/**
 * Create Meeting Input (v4.1)
 */
export interface CreateMeetingInput {
  meetingNo: string;
  meetingProvider: string;
  reserveId: string; // v4.1 - Reserve ID (Feishu reserve_id, Zoom meeting_id)
  topic: string;
  meetingUrl: string;
  ownerId?: string; // v4.1 - Meeting owner ID
  scheduleStartTime: Date;
  scheduleDuration: number;
}

/**
 * Update Meeting Input
 */
export interface UpdateMeetingInput {
  topic?: string;
  scheduleStartTime?: Date;
  scheduleDuration?: number;
  status?: MeetingStatus;
  actualDuration?: number;
  meetingTimeList?: MeetingTimeSegment[];
  recordingUrl?: string;
  lastMeetingEndedTimestamp?: Date;
  pendingTaskId?: string;
  eventType?: string;
}

