import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationQueueService } from './notification-queue.service';
import { EmailService } from '@core/email';
import { NOTIFICATION_SCHEDULER_INTERVAL_MINUTES } from 'src/constants';

/**
 * Notification Scheduler Service
 * 
 * Runs scheduled task to process pending notifications
 * Executes every minute to check and send due notifications
 */
@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);
  private isProcessing = false;

  constructor(
    private readonly notificationQueueService: NotificationQueueService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Process pending notifications
   * Runs at configured interval (default: every minute)
   * 
   * Queries pending notifications where scheduled_time <= NOW()
   * Sends emails and updates status
   */
  @Cron(`*/${NOTIFICATION_SCHEDULER_INTERVAL_MINUTES} * * * *`)
  async processPendingNotifications(): Promise<void> {
    // Prevent concurrent execution
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Fetch pending notifications (max 100 per run)
      const notifications = await this.notificationQueueService.getPendingNotifications(100);

      if (notifications.length === 0) {
        return;
      }

      // Process each notification
      for (const notification of notifications) {
        try {
          // Extract recipient emails
          const recipients = Object.values(notification.recipients).filter(Boolean) as string[];

          if (recipients.length === 0) {
            this.logger.warn(`No recipients found for notification ${notification.id}, skipping`);
            await this.notificationQueueService.markAsFailed(
              notification.id,
              'No recipients found',
            );
            continue;
          }

          // Send email (using existing EmailService)
          // Note: EmailService.send() expects template-based params, but we have pre-built content
          // We'll use a workaround by sending to each recipient individually
          await this.sendEmailToRecipients(
            recipients,
            notification.subject,
            notification.content.html,
          );

          // Mark as sent
          await this.notificationQueueService.markAsSent(notification.id);

          this.logger.log(
            `Successfully sent notification ${notification.id} to ${recipients.length} recipients`,
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Failed to send notification ${notification.id}: ${errorMessage}`,
            error instanceof Error ? error.stack : '',
          );

          // Mark as failed
          await this.notificationQueueService.markAsFailed(notification.id, errorMessage);
        }
      }
    } catch (error) {
      this.logger.error(
        `Error processing pending notifications: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send email to multiple recipients
   * Sends to each recipient individually via EmailService
   * 
   * @param recipients - Array of email addresses
   * @param subject - Email subject
   * @param html - Email HTML content
   */
  private async sendEmailToRecipients(
    recipients: string[],
    subject: string,
    html: string,
  ): Promise<void> {
    // Handle comma-separated emails (e.g., "email1@test.com,email2@test.com")
    const allEmails = recipients
      .flatMap(r => r.split(',').map(e => e.trim()))
      .filter(e => e.length > 0);

    if (allEmails.length === 0) {
      throw new Error('No valid email addresses to send to');
    }

    // Send email to each recipient individually
    for (const email of allEmails) {
      await this.emailService.send({
        to: email,
        subject,
        html, // Use pre-built HTML directly
      });
    }
  }
}

