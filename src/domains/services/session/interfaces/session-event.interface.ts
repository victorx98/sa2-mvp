// Session event entity interface (matches database table)
export interface ISessionEventEntity {
  id: string; // UUID primary key
  sessionId: string; // Associated session ID
  provider: string; // Event source: 'feishu' | 'zoom'
  eventType: string; // Event type (e.g., meeting_started_v1, join_meeting_v1)
  eventData: Record<string, unknown>; // Event payload (JSONB)
  occurredAt: Date; // Event occurrence time
  createdAt: Date; // Record creation time
}

// Common webhook event structure
export interface IWebhookEvent {
  provider: "feishu" | "zoom";
  eventType: string;
  meetingId: string;
  data: Record<string, unknown>;
  occurredAt: Date;
}
