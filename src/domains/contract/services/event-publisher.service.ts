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
import type { IDomainEventData } from "../common/types/event.types";

/**
 * Event Publisher Interface(事件发布器接口)
 * - Abstraction for message broker integration(消息代理集成的抽象)
 * - Implementations: RabbitMQ, Kafka, AWS SNS, etc.(实现：RabbitMQ、Kafka、AWS SNS等)
 */
export interface IEventPublisher {
  /**
   * Publish event to message broker(向消息代理发布事件)
   * @param event - Domain event to publish
   * @returns Promise that resolves when event is published(当事件发布时解决的Promise)
   * @throws Error if publishing fails(如果发布失败则抛出错误)
   */
  publish(event: DomainEvent): Promise<void>;

  /**
   * Subscribe to event type(订阅事件类型)
   * @param eventType - Event type to subscribe to(要订阅的事件类型)
   * @param handler - Event handler function(事件处理函数)
   */
  subscribe(eventType: string, handler: (event: IDomainEventData) => void): void;
}

/**
 * Event Publisher Service(事件发布服务)
 * - Implements Outbox Pattern for reliable event publishing(实现事件日发布的出站模式以提供可靠的事件发布)
 * - Polls domain_events table for pending events(轮询域事件表中的待处理事件)
 * - Publishes events via IEventPublisher abstraction(通过IEventPublisher抽象发布事件)
 * - Handles retries with exponential backoff(使用指数退避处理重试)
 * - Cleans up old published events(清理旧的已发布事件)
 *
 * Design Decisions:(设计决策：)
 * - v2.16.8: Advisory lock prevents multi-instance conflicts(咨询锁防止多实例冲突)
 * - v2.16.8: 30-second polling interval (configurable)(30秒轮询间隔，可配置)
 * - v2.16.8: 7-day retention for published events(已发布事件保留7天)
 * - v2.16.8: Max 3 retries with exponential backoff(最多3次重试，指数退避)
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
   * Process pending events(处理待处理事件)
   * - Query pending events (status = pending, retry_count < max_retries)(查询待处理事件（状态=待处理，重试次数<最大重试次数）)
   * - Use advisory lock to prevent concurrent processing(使用咨询锁防止并发处理)
   * - Publish via IEventPublisher(通过IEventPublisher发布)
   * - Update status to published or failed(更新状态为已发布或失败)
   * - Returns count of successfully published events(返回成功发布事件的数量)
   *
   * Called by: Scheduled task every 30 seconds(由每30秒的定时任务调用)
   */
  async processPendingEvents(tx?: DrizzleTransaction): Promise<number> {
    const LOCK_KEY = 999999; // Advisory lock key for event publishing(事件发布的咨询锁键)
    let publishedCount = 0;
    const executor: DrizzleExecutor = tx ?? this.db;

    try {
      // 1. Acquire advisory lock (non-blocking)(获取咨询锁（非阻塞）)
      const lockResult = await executor.execute(
        sql`SELECT pg_try_advisory_lock(${LOCK_KEY}) as locked`,
      );
      interface LockResult {
        locked: boolean;
      }
      const locked = (lockResult.rows[0] as LockResult).locked;

      if (!locked) {
        this.logger.debug(
          "Another instance is processing events, skipping...(另一个实例正在处理事件，跳过...)",
        );
        return 0;
      }

      try {
        // 2. Query pending events (limit to 100 per batch)(查询待处理事件（每批次限制100个）)
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

        // 3. Process each event(处理每个事件)
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
        // 4. Release advisory lock(释放咨询锁)
        await executor.execute(sql`SELECT pg_advisory_unlock(${LOCK_KEY})`);
      }
    } catch (error) {
      this.logger.error(`Error processing pending events: ${error}`);
      throw error;
    }
  }

  /**
   * Retry failed events(重试失败事件)
   * - Reset retry_count for failed events that are eligible for retry(重置符合重试条件的失败事件的重试次数)
   * - Eligible: failed status AND created within last 24 hours(符合条件：失败状态且在过去24小时内创建)
   * - Returns count of events reset for retry(返回重置重试的事件数量)
   *
   * Called by: Manual admin action or scheduled task(由管理员手动操作或定时任务调用)
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
   * Cleanup old published events(清理旧的已发布事件)
   * - Delete published events older than retention period (default: 7 days)(删除超过保留期的已发布事件(默认：7天))
   * - Keeps failed events for troubleshooting(保留失败事件用于故障排除)
   * - Returns count of deleted events(返回删除事件的数量)
   *
   * Called by: Scheduled task daily at 2 AM(由每日凌晨2点的定时任务调用)
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
   * Get event statistics(获取事件统计)
   * - Count events by status(按状态统计事件)
   * - Returns event counts for monitoring(返回用于监控的事件计数)
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
