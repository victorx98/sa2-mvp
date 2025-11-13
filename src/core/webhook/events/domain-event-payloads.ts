/**
 * Domain Event Payloads
 *
 * Defines the data structure for each domain event published by the Webhook module
 * These events are published when meeting events occur (started, ended, recording ready, etc.)
 */

/**
 * Payload for session meeting started event
 * Published when a Feishu meeting starts
 */
export interface FeishuMeetingEventPayload {
  // Meeting identification
  meetingId: string;
  meetingNo: string | null;

  // Event identification and tracking
  eventId: string;
  eventType: string;

  // Provider information
  provider: string;

  // Operator information
  operatorId: string | null;
  operatorRole: number | null; // 1 = host, 2 = participant

  // Meeting information
  meetingTopic: string | null;
  meetingStartTime: Date | null;
  meetingEndTime: Date | null;

  // Recording information (for recording_ready event)
  recordingId: string | null;
  recordingUrl: string | null;

  // Event timestamp
  occurredAt: Date;

  // Complete raw webhook payload for audit trail
  eventData: Record<string, any>;
}

/**
 * Domain event names enum
 * Semantic naming convention: services.{domain}.{action}
 */
export enum DomainEventNames {
  // Session domain events
  SESSION_MEETING_STARTED = "services.session.meeting_started",
  SESSION_MEETING_ENDED = "services.session.meeting_ended",
  SESSION_RECORDING_READY = "services.session.recording_ready",
}

