import { Inject, Injectable, Logger } from "@nestjs/common";
import { eq, and, lte } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { IQueuedNotification } from "../queue/notification-queue.interface";
import { NotificationType } from "../dto/queue-notification.dto";

/**
 * Notification Queue Repository
 *
 * Data access layer for notification_queue table
 */
@Injectable()
export class NotificationQueueRepository {
  private readonly logger = new Logger(NotificationQueueRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Create notification in queue
   *
   * @param notification - Notification data
   * @returns Created notification
   */
  async create(
    notification: Omit<IQueuedNotification, "id" | "createdAt">,
  ): Promise<IQueuedNotification> {
    const [created] = await this.db
      .insert(schema.notificationQueue)
      .values({
        sessionId: notification.sessionId,
        type: notification.type,
        recipient: notification.recipient,
        template: notification.template,
        data: notification.data as never,
        scheduledTime: notification.scheduledTime,
        status: notification.status,
        sentAt: notification.sentAt,
        error: notification.error,
      })
      .returning();

    return this.mapToEntity(created);
  }

  /**
   * Find notification by ID
   *
   * @param id - Notification ID
   * @returns Notification or null
   */
  async findById(id: string): Promise<IQueuedNotification | null> {
    const [notification] = await this.db
      .select()
      .from(schema.notificationQueue)
      .where(eq(schema.notificationQueue.id, id));

    return notification ? this.mapToEntity(notification) : null;
  }

  /**
   * Find all notifications by session ID
   *
   * @param sessionId - Session ID
   * @returns Array of notifications
   */
  async findBySessionId(sessionId: string): Promise<IQueuedNotification[]> {
    const notifications = await this.db
      .select()
      .from(schema.notificationQueue)
      .where(eq(schema.notificationQueue.sessionId, sessionId));

    return notifications.map((n) => this.mapToEntity(n));
  }

  /**
   * Find due notifications (scheduled_time <= now and status = pending)
   *
   * @param now - Current time
   * @returns Array of due notifications
   */
  async findDueNotifications(now: Date): Promise<IQueuedNotification[]> {
    const notifications = await this.db
      .select()
      .from(schema.notificationQueue)
      .where(
        and(
          eq(schema.notificationQueue.status, "pending"),
          lte(schema.notificationQueue.scheduledTime, now),
        ),
      );

    return notifications.map((n) => this.mapToEntity(n));
  }

  /**
   * Update notification
   *
   * @param id - Notification ID
   * @param updates - Fields to update
   * @returns Updated notification
   */
  async update(
    id: string,
    updates: Partial<
      Pick<IQueuedNotification, "status" | "sentAt" | "error" | "scheduledTime">
    >,
  ): Promise<IQueuedNotification> {
    const [updated] = await this.db
      .update(schema.notificationQueue)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(schema.notificationQueue.id, id))
      .returning();

    return this.mapToEntity(updated);
  }

  /**
   * Cancel all pending notifications for a session
   *
   * @param sessionId - Session ID
   * @returns Number of cancelled notifications
   */
  async cancelBySessionId(sessionId: string): Promise<number> {
    const result = await this.db
      .update(schema.notificationQueue)
      .set({
        status: "cancelled",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.notificationQueue.sessionId, sessionId),
          eq(schema.notificationQueue.status, "pending"),
        ),
      )
      .returning();

    return result.length;
  }

  /**
   * Update scheduled time for all pending notifications of a session
   *
   * @param sessionId - Session ID
   * @param newTime - New scheduled time
   * @returns Number of updated notifications
   */
  async updateScheduledTimeBySessionId(
    sessionId: string,
    newTime: Date,
  ): Promise<number> {
    const result = await this.db
      .update(schema.notificationQueue)
      .set({
        scheduledTime: newTime,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.notificationQueue.sessionId, sessionId),
          eq(schema.notificationQueue.status, "pending"),
        ),
      )
      .returning();

    return result.length;
  }

  /**
   * Delete old notifications
   *
   * @param before - Delete notifications created before this date
   * @returns Number of deleted notifications
   */
  async deleteOldNotifications(before: Date): Promise<number> {
    const result = await this.db
      .delete(schema.notificationQueue)
      .where(
        and(
          lte(schema.notificationQueue.createdAt, before),
          eq(schema.notificationQueue.status, "sent"),
        ),
      )
      .returning();

    return result.length;
  }

  /**
   * Get statistics by status
   *
   * @returns Statistics object
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  }> {
    const all = await this.db.select().from(schema.notificationQueue);

    const stats = {
      total: all.length,
      pending: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const notification of all) {
      stats[notification.status]++;
    }

    return stats;
  }

  /**
   * Map database record to entity
   *
   * @param record - Database record
   * @returns Notification entity
   */
  private mapToEntity(
    record: typeof schema.notificationQueue.$inferSelect,
  ): IQueuedNotification {
    return {
      id: record.id,
      sessionId: record.sessionId,
      type: record.type as unknown as NotificationType,
      recipient: record.recipient,
      template: record.template,
      data: record.data as Record<string, unknown>,
      scheduledTime: record.scheduledTime,
      status: record.status,
      createdAt: record.createdAt,
      sentAt: record.sentAt || undefined,
      error: record.error || undefined,
    };
  }
}
