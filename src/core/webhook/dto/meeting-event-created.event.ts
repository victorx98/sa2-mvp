/**
 * Meeting Event Created Event
 * 
 * DEPRECATED: This event is kept for backward compatibility with existing subscribers
 * 
 * In v4.0 architecture, this event should be published by Core Meeting Module,
 * not by Webhook Module. Webhook Module now only forwards raw events to Core Meeting.
 * 
 * TODO: Remove this file after downstream modules migrate to new event structure
 * from Core Meeting Module (e.g., MeetingLifecycleCompletedEvent)
 */
export class MeetingEventCreated {
  constructor(
    public readonly meetingId: string,
    public readonly meetingNo: string | null,
    public readonly eventId: string,
    public readonly eventType: string,
    public readonly provider: string,
    public readonly operatorId: string | null,
    public readonly operatorRole: number | null,
    public readonly meetingTopic: string | null,
    public readonly occurredAt: Date,
    public readonly eventData: Record<string, any>,
  ) {}
}

