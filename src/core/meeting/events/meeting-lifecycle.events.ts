import { MeetingTimeSegment } from "../entities/meeting.entity";

/**
 * Meeting Lifecycle Completed Event
 *
 * Published by Core Meeting Module when a meeting has been finalized
 * Downstream domains (mentoring, interview, etc.) listen to this event
 */
export class MeetingLifecycleCompletedEvent {
  readonly eventName = "meeting.lifecycle.completed";

  constructor(
    public readonly meetingId: string, // UUID - Primary key for downstream FK lookups
    public readonly meetingNo: string, // Meeting number (Feishu 9-digit)
    public readonly provider: string, // 'feishu' | 'zoom'
    public readonly scheduleStartTime: Date, // Scheduled start time
    public readonly actualDuration: number, // Physical duration in seconds
    public readonly recordingUrl: string | null, // Recording URL (if available)
    public readonly endedAt: Date, // Final completion timestamp
    public readonly timeList: MeetingTimeSegment[], // Meeting time segments
  ) {}
}

/**
 * Meeting Status Changed Event
 *
 * Internal event for tracking meeting status transitions
 */
export class MeetingStatusChangedEvent {
  readonly eventName = "meeting.status.changed";

  constructor(
    public readonly meetingId: string,
    public readonly meetingNo: string,
    public readonly oldStatus: string,
    public readonly newStatus: string,
    public readonly changedAt: Date,
  ) {}
}

/**
 * Meeting Recording Ready Event
 *
 * Published when meeting recording becomes available
 */
export class MeetingRecordingReadyEvent {
  readonly eventName = "meeting.recording.ready";

  constructor(
    public readonly meetingId: string,
    public readonly meetingNo: string,
    public readonly recordingUrl: string,
    public readonly readyAt: Date,
  ) {}
}

