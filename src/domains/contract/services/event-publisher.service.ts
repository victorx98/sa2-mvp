import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, lt, sql } from "drizzle-orm";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type {
  DrizzleDatabase,
  DrizzleExecutor,
  DrizzleTransaction,
} from "@shared/types/database.types";
import { EVENT_RETENTION_DAYS } from "../common/constants/contract.constants";
import type { DomainEvent } from "@infrastructure/database/schema";

/**
 * Event Publisher Interface
 * - Abstraction for message broker integration
 * - Implementations: RabbitMQ, Kafka, AWS SNS, etc.
 */
export interface IEventPublisher {
  /**
   * Publish event to message broker
   * @param event - Domain event to publish
   * @returns Promise that resolves when event is published
   * @throws Error if publishing fails
   */
  publish(event: DomainEvent): Promise<void>;
}

/**
 * Event Publisher Service
 * - Implements Outbox Pattern for reliable event publishing
 * - Polls domain_events table for pending events
 * - Publishes events via IEventPublisher abstraction
 * - Handles retries with exponential backoff
 * - Cleans up old published events
 *
 * Design Decisions:
 * - v2.16.8: Advisory lock prevents multi-instance conflicts
 * - v2.16.8: 30-second polling interval (configurable)
 * - v2.16.8: 7-day retention for published events
 * - v2.16.8: Max 3 retries with exponential backoff
 */
@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    @Inject("EVENT_PUBLISHER")
    private readonly eventPublisher: IEventPublisher,
  ) {}

  /**
   * Process pending events
   * - Query pending events (status = pending, retry_count < max_retries)
   * - Use advisory lock to prevent concurrent processing
   * - Publish via IEventPublisher
   * - Update status to published or failed
   * - Returns count of successfully published events
   *
   * Called by: Scheduled task every 30 seconds
   */
  async processPendingEvents(tx?: DrizzleTransaction): Promise<number> {
    const LOCK_KEY = 999999; // Advisory lock key for event publishing
    let publishedCount = 0;
    const executor: DrizzleExecutor = tx ?? this.db;

    try {
      // 1. Acquire advisory lock (non-blocking)
      const lockResult = await executor.execute(
        sql`SELECT pg_try_advisory_lock(${LOCK_KEY}) as locked`,
      );
      const locked = (lockResult.rows[0] as any).locked;

      if (!locked) {
        this.logger.debug("Another instance is processing events, skipping...");
        return 0;
      }

      try {
        // 2. Query pending events (limit to 100 per batch)
        const pendingEvents = await executor
          .select()
          .from(schema.domainEvents)
          .where(
            and(
              eq(schema.domainEvents.status, "pending"),
              lt(
                schema.domainEvents.retryCount,
                sql`${schema.domainEvents.maxRetries}`,
              ),
            ),
          )
          .orderBy(schema.domainEvents.createdAt)
          .limit(100);

        this.logger.log(`Processing ${pendingEvents.length} pending events`);

        // 3. Process each event
        for (const event of pendingEvents) {
          try {
            // Publish event
            await this.eventPublisher.publish(event);

            // Update status to published
            await executor
              .update(schema.domainEvents)
              .set({
                status: "published",
                publishedAt: new Date(),
                errorMessage: null,
              })
              .where(eq(schema.domainEvents.id, event.id));

            publishedCount++;
            this.logger.log(
              `Published event: ${event.eventType} (${event.id})`,
            );
          } catch (error) {
            // Handle publishing failure
            const newRetryCount = event.retryCount + 1;
            const newStatus =
              newRetryCount >= event.maxRetries ? "failed" : "pending";

            await executor
              .update(schema.domainEvents)
              .set({
                status: newStatus,
                retryCount: newRetryCount,
                errorMessage:
                  error instanceof Error ? error.message : String(error),
              })
              .where(eq(schema.domainEvents.id, event.id));

            this.logger.error(
              `Failed to publish event ${event.id} (retry ${newRetryCount}/${event.maxRetries}): ${error}`,
            );
          }
        }

        return publishedCount;
      } finally {
        // 4. Release advisory lock
        await executor.execute(sql`SELECT pg_advisory_unlock(${LOCK_KEY})`);
      }
    } catch (error) {
      this.logger.error(`Error processing pending events: ${error}`);
      throw error;
    }
  }

  /**
   * Retry failed events
   * - Reset retry_count for failed events that are eligible for retry
   * - Eligible: failed status AND created within last 24 hours
   * - Returns count of events reset for retry
   *
   * Called by: Manual admin action or scheduled task
   */
  async retryFailedEvents(tx?: DrizzleTransaction): Promise<number> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    const executor: DrizzleExecutor = tx ?? this.db;

    const retriedEvents = await executor
      .update(schema.domainEvents)
      .set({
        status: "pending",
        retryCount: 0,
        errorMessage: null,
      })
      .where(
        and(
          eq(schema.domainEvents.status, "failed"),
          sql`${schema.domainEvents.createdAt} > ${twentyFourHoursAgo}`,
        ),
      )
      .returning();

    this.logger.log(`Reset ${retriedEvents.length} failed events for retry`);
    return retriedEvents.length;
  }

  /**
   * Cleanup old published events
   * - Delete published events older than retention period (default: 7 days)
   * - Keeps failed events for troubleshooting
   * - Returns count of deleted events
   *
   * Called by: Scheduled task daily at 2 AM
   */
  async cleanupOldEvents(tx?: DrizzleTransaction): Promise<number> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - EVENT_RETENTION_DAYS);
    const executor: DrizzleExecutor = tx ?? this.db;

    const deletedEvents = await executor
      .delete(schema.domainEvents)
      .where(
        and(
          eq(schema.domainEvents.status, "published"),
          lt(schema.domainEvents.publishedAt, retentionDate),
        ),
      )
      .returning();

    this.logger.log(
      `Cleaned up ${deletedEvents.length} old published events (older than ${EVENT_RETENTION_DAYS} days)`,
    );
    return deletedEvents.length;
  }

  /**
   * Get event statistics
   * - Count events by status
   * - Returns event counts for monitoring
   */
  async getEventStats(): Promise<{
    pending: number;
    published: number;
    failed: number;
  }> {
    const pendingCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.domainEvents)
      .where(eq(schema.domainEvents.status, "pending"));

    const publishedCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.domainEvents)
      .where(eq(schema.domainEvents.status, "published"));

    const failedCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.domainEvents)
      .where(eq(schema.domainEvents.status, "failed"));

    return {
      pending: Number(pendingCount[0]?.count || 0),
      published: Number(publishedCount[0]?.count || 0),
      failed: Number(failedCount[0]?.count || 0),
    };
  }
}
