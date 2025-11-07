import { Injectable, Logger } from "@nestjs/common";
import { IEventPublisher } from "./event-publisher.service";
import type { DomainEvent } from "@infrastructure/database/schema";

/**
 * Mock Event Publisher
 * - Development/testing implementation of IEventPublisher
 * - Logs events to console instead of publishing to message broker
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

  /**
   * Simulate event publishing by logging to console
   * - In production, replace with actual message broker client
   */
  async publish(event: DomainEvent): Promise<void> {
    this.logger.log(`[MOCK] Publishing event: ${event.eventType}`);
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

    this.logger.log(`[MOCK] Event published successfully: ${event.id}`);
  }
}
