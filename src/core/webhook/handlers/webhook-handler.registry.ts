import { Injectable, Logger } from "@nestjs/common";
import {
  IWebhookHandler,
  IWebhookEvent,
} from "../interfaces/webhook-handler.interface";
import { FeishuWebhookHandler } from "./feishu-webhook.handler";
import { ZoomWebhookHandler } from "./zoom-webhook.handler";
import { WebhookEventNotSupportedException } from "../exceptions/webhook.exception";

/**
 * Webhook Handler Registry
 *
 * Central registry for managing and dispatching webhook events to appropriate handlers
 * Uses Chain of Responsibility pattern
 */
@Injectable()
export class WebhookHandlerRegistry {
  private readonly logger = new Logger(WebhookHandlerRegistry.name);
  private readonly handlers: IWebhookHandler[] = [];

  constructor(
    private readonly feishuHandler: FeishuWebhookHandler,
    private readonly zoomHandler: ZoomWebhookHandler,
  ) {
    // Register all handlers
    this.registerHandler(feishuHandler);
    this.registerHandler(zoomHandler);

    this.logger.log(
      `Webhook handler registry initialized with ${this.handlers.length} handlers`,
    );
  }

  /**
   * Register a webhook handler
   */
  private registerHandler(handler: IWebhookHandler): void {
    this.handlers.push(handler);
    this.logger.debug(
      `Registered handler for event types: ${handler.getSupportedEventTypes().join(", ")}`,
    );
  }

  /**
   * Dispatch event to appropriate handler
   *
   * @param event - Webhook event to process
   * @throws WebhookEventNotSupportedException if no handler supports the event type
   */
  async dispatchEvent(event: IWebhookEvent): Promise<void> {
    this.logger.debug(`Dispatching event: ${event.eventType}`);

    // Find handler that supports this event type
    const handler = this.findHandler(event.eventType);

    if (!handler) {
      this.logger.warn(`No handler found for event type: ${event.eventType}`);
      throw new WebhookEventNotSupportedException(event.eventType);
    }

    // Handle the event
    await handler.handleEvent(event);

    this.logger.debug(`Event ${event.eventType} processed successfully`);
  }

  /**
   * Find handler that supports the given event type
   *
   * @param eventType - Event type to match
   * @returns Handler that supports the event type, or null if none found
   */
  private findHandler(eventType: string): IWebhookHandler | null {
    for (const handler of this.handlers) {
      const supportedTypes = handler.getSupportedEventTypes();

      // Check if handler supports this event type
      if (supportedTypes.includes(eventType)) {
        return handler;
      }

      // Also check for wildcard patterns (e.g., "vc.meeting.*")
      const matchesPattern = supportedTypes.some((pattern) => {
        if (pattern.includes("*")) {
          const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
          return regex.test(eventType);
        }
        return false;
      });

      if (matchesPattern) {
        return handler;
      }
    }

    return null;
  }

  /**
   * Get all registered handlers
   */
  getHandlers(): IWebhookHandler[] {
    return this.handlers;
  }

  /**
   * Get all supported event types
   */
  getSupportedEventTypes(): string[] {
    const allTypes = new Set<string>();

    for (const handler of this.handlers) {
      handler.getSupportedEventTypes().forEach((type) => allTypes.add(type));
    }

    return Array.from(allTypes);
  }
}
