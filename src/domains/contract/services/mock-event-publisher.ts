import { Injectable, Logger } from "@nestjs/common";
import { IEventPublisher } from "./event-publisher.service";
import { EventBusService } from "../events/event-bus.service";
import type { DomainEvent } from "@infrastructure/database/schema";
import type { IDomainEventData } from "../common/types/event.types";

/**
 * Mock Event Publisher
 * - Development/testing implementation of IEventPublisher
 * - Logs events to console instead of publishing to message broker
 * - Uses EventBusService for local event communication
 * - Replace with real implementation (RabbitMQ, Kafka, etc.) in production
 *
 * Production Implementations:
 * - RabbitMQEventPublisher: Publish to RabbitMQ exchange
 * - KafkaEventPublisher: Publish to Kafka topic
 * - SNSEventPublisher: Publish to AWS SNS topic
 * - WebhookEventPublisher: POST to webhook endpoints
 */
@Injectable()
export class MockEventPublisher implements IEventPublisher {
  private readonly logger = new Logger(MockEventPublisher.name);

  constructor(private readonly eventBus: EventBusService) {}

  /**
   * Publish event via EventBus (logs to console for debugging)
   * 通过 EventBus 发布事件（记录到控制台以进行调试）
   *
   * @param event - Domain event to publish
   */
  async publish(event: DomainEvent): Promise<void> {
    this.logger.log(
      `[MOCK] Publishing event: ${event.eventType}, ID: ${event.id}`,
    );
    this.logger.debug(
      `[MOCK] Event payload:`,
      JSON.stringify(event.payload, null, 2),
    );

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Simulate 1% failure rate for testing retry logic
    if (Math.random() < 0.01) {
      throw new Error("Simulated publishing failure");
    }

    // Publish to local event bus
    this.eventBus.publish(event);

    this.logger.log(`[MOCK] Event published successfully: ${event.id}`);
  }

  /**
   * Subscribe to event type via EventBus
   * 通过 EventBus 订阅事件类型
   *
   * @param eventType - Event type to subscribe to
   * @param handler - Event handler function
   */
  subscribe(
    eventType: string,
    handler: (event: IDomainEventData) => void,
  ): void {
    this.logger.log(`[MOCK] Subscribing to event type: ${eventType}`);
    this.eventBus.subscribe(eventType, handler);
  }
}
