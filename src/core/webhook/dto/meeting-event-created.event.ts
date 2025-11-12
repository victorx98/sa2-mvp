/**
 * MeetingEventCreated Domain Event
 *
 * Published by Webhook Module after processing and storing meeting events
 * Subscribed by Session Domain, Comm Session Domain, Class Session Domain
 * Carries minimal essential data to avoid coupling; subscribers query by meeting_no
 */
export class MeetingEventCreated {
  /**
   * Meeting ID (platform-specific)
   */
  readonly meetingId: string;

  /**
   * Feishu meeting number (key field for querying sessions by Domain)
   */
  readonly meetingNo: string | null;

  /**
   * Event ID (unique identifier for deduplication)
   */
  readonly eventId: string;

  /**
   * Event type (e.g., "vc.meeting.meeting_started_v1", "meeting.started")
   */
  readonly eventType: string;

  /**
   * Event provider platform ('feishu' | 'zoom')
   */
  readonly provider: string;

  /**
   * Operator ID (user who triggered the event)
   */
  readonly operatorId: string | null;

  /**
   * Operator role (1 = host, 2 = participant, null if not applicable)
   */
  readonly operatorRole: number | null;

  /**
   * Meeting topic/title
   */
  readonly meetingTopic: string | null;

  /**
   * Event occurrence time
   */
  readonly occurredAt: Date;

  /**
   * Complete original event data (for special cases)
   * Contains platform-specific fields and extra information
   */
  readonly eventData: Record<string, any>;

  constructor(
    meetingId: string,
    meetingNo: string | null,
    eventId: string,
    eventType: string,
    provider: string,
    operatorId: string | null,
    operatorRole: number | null,
    meetingTopic: string | null,
    occurredAt: Date,
    eventData: Record<string, any>,
  ) {
    this.meetingId = meetingId;
    this.meetingNo = meetingNo;
    this.eventId = eventId;
    this.eventType = eventType;
    this.provider = provider;
    this.operatorId = operatorId;
    this.operatorRole = operatorRole;
    this.meetingTopic = meetingTopic;
    this.occurredAt = occurredAt;
    this.eventData = eventData;
  }
}

