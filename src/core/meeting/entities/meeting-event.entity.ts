/**
 * Meeting Event Entity
 *
 * Event sourcing entity for meeting events
 * Stores all raw webhook events for audit trail and replay
 */

export interface MeetingEventEntity {
  id: string; // UUID primary key
  meetingNo: string; // Meeting number (for Feishu)
  meetingId: string; // Platform meeting ID
  eventId: string; // Unique event ID (from webhook header, for deduplication)
  eventType: string; // Event type (e.g., 'vc.meeting.meeting_started_v1')
  provider: string; // 'feishu' | 'zoom'
  operatorId: string | null; // User ID who triggered the event
  operatorRole: number | null; // 1 = host, 2 = participant
  meetingTopic: string | null; // Meeting topic (extracted from event)
  meetingStartTime: Date | null; // Meeting start time (if available in event)
  meetingEndTime: Date | null; // Meeting end time (if available in event)
  eventData: Record<string, unknown>; // Complete raw webhook payload (JSONB)
  occurredAt: Date; // Event occurrence time (from webhook header)
  createdAt: Date; // Record creation time
}

/**
 * Create Meeting Event Input
 */
export interface CreateMeetingEventInput {
  meetingNo: string;
  meetingId: string;
  eventId: string;
  eventType: string;
  provider: string;
  operatorId?: string | null;
  operatorRole?: number | null;
  meetingTopic?: string | null;
  meetingStartTime?: Date | null;
  meetingEndTime?: Date | null;
  eventData: Record<string, unknown>;
  occurredAt: Date;
}

