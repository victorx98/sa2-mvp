import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

/**
 * Webhook Event Bus Service
 *
 * Wraps NestJS EventEmitter2 for publishing domain events
 * Provides async event publishing with type safety
 */
@Injectable()
export class WebhookEventBusService {
  private readonly logger = new Logger(WebhookEventBusService.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Publish a domain event to all subscribers
   *
   * @param event - Domain event to publish
   * @returns Promise that resolves when event is published
   */
  async publish<T = any>(event: T): Promise<void> {
    const eventName = event.constructor.name;
    this.logger.debug(`Publishing event: ${eventName}`);

    try {
      await this.eventEmitter.emitAsync(eventName, event);
      this.logger.debug(`Event published successfully: ${eventName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to publish event ${eventName}: ${message}`);
      // Don't throw - webhook should return 200 even if publishing fails
      // Event is already stored in database for manual retry
    }
  }

  /**
   * Subscribe to events of a specific type
   *
   * @param eventClass - Event class/type to subscribe to
   * @param handler - Handler function to call when event is published
   */
  subscribe<T = any>(
    eventClass: new (...args: any[]) => T,
    handler: (event: T) => Promise<void> | void,
  ): void {
    const eventName = eventClass.name;
    this.logger.log(`Subscribing to event: ${eventName}`);
    this.eventEmitter.on(eventName, handler);
  }
}

