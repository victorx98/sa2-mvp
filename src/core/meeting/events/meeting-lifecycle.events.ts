/**
 * NOTE: MeetingLifecycleCompletedEvent has been moved to @application/events
 * Import from there: import { MeetingLifecycleCompletedEvent } from '@application/events';
 * 
 * This file now only contains internal events for the Meeting module
 */

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
 * NOTE: MeetingRecordingReadyEvent has been moved to @application/events
 * Import from there: import { MeetingRecordingReadyEvent } from '@application/events';
 */

/**
 * NOTE: MeetingCancelledEvent has been REMOVED
 * Reason: Meeting cancellation is handled synchronously in Application layer
 * No event is published for cancellations - updates happen directly in transaction
 */
