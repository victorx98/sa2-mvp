import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationService } from "../services/notification.service";
import {
  QueueNotificationDto,
  NotificationType,
} from "../dto/queue-notification.dto";
import { IQueuedNotification } from "./notification-queue.interface";
import { NotificationQueueRepository } from "../repositories/notification-queue.repository";

/**
 * Notification Queue Service
 *
 * Manages queued notifications with scheduled sending
 * Uses database for persistent storage
 */
@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly repository: NotificationQueueRepository,
  ) {}

  /**
   * Enqueue notification
   *
   * @param notification - Notification to queue
   * @returns Notification ID
   */
  async enqueue(notification: QueueNotificationDto): Promise<string> {
    const queuedNotification: Omit<IQueuedNotification, "id" | "createdAt"> = {
      sessionId: notification.sessionId,
      type: notification.type,
      recipient: notification.recipient,
      template: notification.template,
      data: notification.data,
      scheduledTime: notification.scheduledTime,
      status: "pending",
    };

    const created = await this.repository.create(queuedNotification);

    this.logger.log(
      `Notification queued: ${created.id}, scheduled for ${notification.scheduledTime.toISOString()}`,
    );

    return created.id;
  }

  /**
   * Process due notifications (Cron job - runs every minute)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueNotifications(): Promise<void> {
    const now = new Date();
    const dueNotifications = await this.repository.findDueNotifications(now);

    if (dueNotifications.length === 0) {
      return;
    }

    this.logger.debug(
      `Processing ${dueNotifications.length} due notifications`,
    );

    // Process each notification
    for (const notification of dueNotifications) {
      await this.sendNotification(notification);
    }
  }

  /**
   * Cancel notifications by session ID
   *
   * @param sessionId - Session ID
   * @returns Number of cancelled notifications
   */
  async cancelBySessionId(sessionId: string): Promise<number> {
    const count = await this.repository.cancelBySessionId(sessionId);

    this.logger.log(
      `Cancelled ${count} notifications for session: ${sessionId}`,
    );

    return count;
  }

  /**
   * Update scheduled time for notifications by session ID
   *
   * @param sessionId - Session ID
   * @param newTime - New scheduled time
   * @returns Number of updated notifications
   */
  async updateBySessionId(sessionId: string, newTime: Date): Promise<number> {
    const count = await this.repository.updateScheduledTimeBySessionId(
      sessionId,
      newTime,
    );

    this.logger.log(
      `Updated ${count} notifications for session: ${sessionId} to ${newTime.toISOString()}`,
    );

    return count;
  }

  /**
   * Get all notifications for a session
   *
   * @param sessionId - Session ID
   * @returns Array of notifications
   */
  async getBySessionId(sessionId: string): Promise<IQueuedNotification[]> {
    return this.repository.findBySessionId(sessionId);
  }

  /**
   * Get queue statistics
   *
   * @returns Queue statistics
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
  }> {
    return this.repository.getStatistics();
  }

  /**
   * Send notification
   *
   * @param notification - Notification to send
   */
  private async sendNotification(
    notification: IQueuedNotification,
  ): Promise<void> {
    this.logger.debug(`Sending notification: ${notification.id}`);

    try {
      if (notification.type === NotificationType.EMAIL) {
        await this.notificationService.sendEmail({
          to: notification.recipient,
          subject: notification.template,
          template: notification.template,
          data: notification.data,
        });
      } else if (notification.type === NotificationType.FEISHU_BOT) {
        // TODO: Implement Feishu bot notification
        this.logger.warn(
          `Feishu bot notification not yet implemented: ${notification.id}`,
        );
      }

      // Mark as sent
      await this.repository.update(notification.id, {
        status: "sent",
        sentAt: new Date(),
      });

      this.logger.log(`Notification sent successfully: ${notification.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Mark as failed
      await this.repository.update(notification.id, {
        status: "failed",
        error: message,
      });

      this.logger.error(
        `Failed to send notification ${notification.id}: ${message}`,
      );
    }
  }

  /**
   * Clean up old notifications (older than 7 days)
   * Can be called periodically
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupOldNotifications(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const count = await this.repository.deleteOldNotifications(sevenDaysAgo);

    this.logger.log(`Cleaned up ${count} old notifications`);
  }
}
