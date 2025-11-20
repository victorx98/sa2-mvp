/**
 * Webhook Event DTO
 *
 * Base DTO for webhook events from different platforms
 */

// Feishu webhook request structure
export interface IFeishuWebhookRequest {
  challenge?: string; // URL verification challenge
  encrypt?: string; // Encrypted data (if encryption is enabled)
  token?: string; // Verification token
  type?: string; // Event type ("url_verification" or "event_callback")
  event?: {
    type: string; // Event type (e.g., "vc.meeting.meeting_started_v1")
    [key: string]: unknown; // Event-specific data
  };
  schema?: string; // Schema version
  header?: {
    event_id: string; // Event ID
    event_type: string; // Event type
    create_time: string; // Creation time
    token: string; // Verification token
    app_id: string; // App ID
    tenant_key: string; // Tenant key
  };
}

// Zoom webhook request structure
export interface IZoomWebhookRequest {
  event: string; // Event type
  payload: {
    account_id: string;
    object: {
      id: string; // Meeting ID
      uuid: string; // Meeting UUID
      host_id: string;
      topic: string;
      type: number;
      start_time: string;
      duration: number;
      timezone: string;
      [key: string]: unknown;
    };
  };
  event_ts: number; // Event timestamp
}

// Generic webhook request
export interface IWebhookRequest {
  headers: Record<string, string>;
  body: IFeishuWebhookRequest | IZoomWebhookRequest | unknown;
  rawBody?: string; // Raw body for signature verification
}

/**
 * Standard Event DTO
 * 
 * Standardized event format passed from Webhook Module to Core Meeting Module
 * This is the single contract between infrastructure and core layers
 */
export interface StandardEventDto {
  meetingNo: string; // Unified meeting number (e.g., "123456789")
  meetingId?: string; // Platform-specific meeting ID (if available in payload)
  eventType: string; // Original event type (e.g., "vc.meeting.meeting_ended_v1")
  provider: "feishu" | "zoom"; // Platform identifier
  eventData: Record<string, any>; // Complete raw webhook payload
  occurredAt: Date; // Event occurrence timestamp (from platform)
  operatorId?: string; // User ID who triggered the event (if available)
}
