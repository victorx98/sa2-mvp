import { IEvent } from "./event.types";

export const MEETING_RECORDING_READY_EVENT = "meeting.recording.ready";

/**
 * Meeting Recording Ready Event Payload
 * 
 * Published when meeting recording becomes available
 * Subscribers: Mentoring, Interview modules (for AI summary generation)
 */
export interface MeetingRecordingReadyPayload {
  meetingId: string; // UUID - Primary key
  meetingNo: string; // Meeting number
  recordingUrl: string; // Recording URL
  readyAt: Date; // Recording ready timestamp
}

/**
 * Meeting Recording Ready Event
 * Extends IEvent with typed payload
 */
export interface MeetingRecordingReadyEvent 
  extends IEvent<MeetingRecordingReadyPayload> {
  type: typeof MEETING_RECORDING_READY_EVENT;
}

