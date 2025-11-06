/**
 * Webhook Handler Interface
 *
 * Unified interface for handling webhooks from different platforms
 */

// Webhook event data structure
export interface IWebhookEvent {
  eventType: string; // Event type (e.g., "vc.meeting.meeting_started_v1")
  eventData: unknown; // Event payload (platform-specific)
  timestamp: number; // Event timestamp
  eventId?: string; // Event ID (for deduplication)
}

// Webhook handler interface
export interface IWebhookHandler {
  /**
   * Handle webhook event
   * @param event - Webhook event data
   */
  handleEvent(event: IWebhookEvent): Promise<void>;

  /**
   * Get supported event types for this handler
   * @returns Array of event type patterns
   */
  getSupportedEventTypes(): string[];
}
