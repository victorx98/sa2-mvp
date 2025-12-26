import { Inject, Injectable, Logger } from '@nestjs/common';
import { sql, eq, and, lte } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import type { DrizzleExecutor, DrizzleTransaction } from '@shared/types/database.types';
import {
  IScheduleRemindersDto,
  INotificationQueueEntity,
  NotificationStatus,
  NotificationType,
  ReminderType,
  IEmailRecipients,
  IEmailContent,
} from '../interfaces';
import { EmailService } from '@core/email/services/email.service';

/**
 * Notification Queue Service
 * 
 * Manages notification queue for scheduled reminders
 * Supports create, update, cancel, and query operations
 */
@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Schedule reminders for a session (3 days, 1 day, 3 hours before)
   * Creates 3 notification queue entries
   * 
   * @param dto - Schedule reminders DTO
   * @param tx - Optional transaction
   */
  async scheduleReminders(
    dto: IScheduleRemindersDto,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const scheduledAt = new Date(dto.scheduledAt);

    // Calculate reminder times
    const threeDaysBefore = new Date(scheduledAt.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oneDayBefore = new Date(scheduledAt.getTime() - 1 * 24 * 60 * 60 * 1000);
    const threeHoursBefore = new Date(scheduledAt.getTime() - 3 * 60 * 60 * 1000);

    // Build recipients object
    const recipients: IEmailRecipients = {
      mentor: dto.recipients.mentorEmail,
      student: dto.recipients.studentEmail,
    };
    if (dto.recipients.counselorEmail) {
      recipients.counselor = dto.recipients.counselorEmail;
    }

    // Build subject prefix with session type, mentor and student names
    const sessionType = dto.sessionInfo.sessionType || 'Regular Mentoring Session';
    const mentorName = dto.sessionInfo.mentorName || 'Mentor';
    const studentName = dto.sessionInfo.studentName || 'Student';
    const sessionTitle = dto.sessionInfo.title;

    // For Class Session, only show mentor name (may have multiple students)
    // For other sessions, show mentor/student
    const isClassSession = sessionType === 'Class Session';
    const subjectNames = isClassSession ? mentorName : `${mentorName}/${studentName}`;

    // Create reminder notifications
    const reminders = [
      {
        sessionId: dto.sessionId,
        type: NotificationType.EMAIL,
        recipients,
        subject: `${sessionType} 3-days Reminder: ${subjectNames} - (${sessionTitle})`,
        content: this.buildReminderContent(dto, '3天', '3 days'),
        reminderType: ReminderType.THREE_DAYS,
        scheduledSendTime: threeDaysBefore,
        status: NotificationStatus.PENDING,
      },
      {
        sessionId: dto.sessionId,
        type: NotificationType.EMAIL,
        recipients,
        subject: `${sessionType} 1-day Reminder: ${subjectNames} - (${sessionTitle})`,
        content: this.buildReminderContent(dto, '1天', '1 day'),
        reminderType: ReminderType.ONE_DAY,
        scheduledSendTime: oneDayBefore,
        status: NotificationStatus.PENDING,
      },
      {
        sessionId: dto.sessionId,
        type: NotificationType.EMAIL,
        recipients,
        subject: `${sessionType} 3-hours Reminder: ${subjectNames} - (${sessionTitle})`,
        content: this.buildReminderContent(dto, '3小时', '3 hours'),
        reminderType: ReminderType.THREE_HOURS,
        scheduledSendTime: threeHoursBefore,
        status: NotificationStatus.PENDING,
      },
    ];

    // Insert notifications
    for (const reminder of reminders) {
      await executor.insert(schema.notificationQueue).values({
        sessionId: reminder.sessionId,
        type: reminder.type,
        recipients: reminder.recipients as any,
        subject: reminder.subject,
        content: reminder.content as any,
        reminderType: reminder.reminderType,
        scheduledSendTime: reminder.scheduledSendTime,
        status: reminder.status,
      });
    }

    this.logger.log(
      `Scheduled 3 reminders for session ${dto.sessionId} at ${threeDaysBefore.toISOString()}, ${oneDayBefore.toISOString()}, ${threeHoursBefore.toISOString()}`,
    );
  }

  /**
   * Update reminders for a session (when rescheduled)
   * Updates scheduled_send_time for all pending reminders
   * 
   * @param sessionId - Session ID
   * @param newScheduledAt - New scheduled time
   * @param tx - Optional transaction
   */
  async updateReminders(
    sessionId: string,
    newScheduledAt: Date,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;
    const scheduledAt = new Date(newScheduledAt);

    // Calculate new reminder times
    const threeDaysBefore = new Date(scheduledAt.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oneDayBefore = new Date(scheduledAt.getTime() - 1 * 24 * 60 * 60 * 1000);
    const threeHoursBefore = new Date(scheduledAt.getTime() - 3 * 60 * 60 * 1000);

    // Update each reminder type
    await executor
      .update(schema.notificationQueue)
      .set({ scheduledSendTime: threeDaysBefore, updatedAt: new Date() })
      .where(
        and(
          eq(schema.notificationQueue.sessionId, sessionId),
          eq(schema.notificationQueue.reminderType, ReminderType.THREE_DAYS),
          eq(schema.notificationQueue.status, NotificationStatus.PENDING),
        ),
      );

    await executor
      .update(schema.notificationQueue)
      .set({ scheduledSendTime: oneDayBefore, updatedAt: new Date() })
      .where(
        and(
          eq(schema.notificationQueue.sessionId, sessionId),
          eq(schema.notificationQueue.reminderType, ReminderType.ONE_DAY),
          eq(schema.notificationQueue.status, NotificationStatus.PENDING),
        ),
      );

    await executor
      .update(schema.notificationQueue)
      .set({ scheduledSendTime: threeHoursBefore, updatedAt: new Date() })
      .where(
        and(
          eq(schema.notificationQueue.sessionId, sessionId),
          eq(schema.notificationQueue.reminderType, ReminderType.THREE_HOURS),
          eq(schema.notificationQueue.status, NotificationStatus.PENDING),
        ),
      );

    this.logger.log(
      `Updated reminders for session ${sessionId} to new times: ${threeDaysBefore.toISOString()}, ${oneDayBefore.toISOString()}, ${threeHoursBefore.toISOString()}`,
    );
  }

  /**
   * Cancel all reminders for a session
   * Updates status to 'cancelled' for all pending reminders
   * 
   * @param sessionId - Session ID
   * @param tx - Optional transaction
   */
  async cancelReminders(
    sessionId: string,
    tx?: DrizzleTransaction,
  ): Promise<void> {
    const executor: DrizzleExecutor = tx ?? this.db;

    await executor
      .update(schema.notificationQueue)
      .set({ status: NotificationStatus.CANCELLED, updatedAt: new Date() })
      .where(
        and(
          eq(schema.notificationQueue.sessionId, sessionId),
          eq(schema.notificationQueue.status, NotificationStatus.PENDING),
        ),
      );

    this.logger.log(`Cancelled all pending reminders for session ${sessionId}`);
  }

  /**
   * Get pending notifications (scheduled_send_time <= NOW)
   * Used by scheduler to fetch notifications to send
   * 
   * @param limit - Max number of notifications to fetch (default: 100)
   * @returns Array of pending notifications
   */
  async getPendingNotifications(limit = 100): Promise<INotificationQueueEntity[]> {
    // Use query instead of execute to avoid prepared statement cache issue
    const result = await this.db.query.notificationQueue.findMany({
      where: (notificationQueue, { eq, and, lte }) => and(
        eq(notificationQueue.status, NotificationStatus.PENDING),
        lte(notificationQueue.scheduledSendTime, new Date())
      ),
      orderBy: (notificationQueue, { asc }) => [asc(notificationQueue.scheduledSendTime)],
      limit,
    });

    return result.map((row) => this.mapToEntity(row));
  }

  /**
   * Mark notification as sent
   * 
   * @param id - Notification ID
   */
  async markAsSent(id: string): Promise<void> {
    await this.db
      .update(schema.notificationQueue)
      .set({ status: NotificationStatus.SENT, sentAt: new Date(), updatedAt: new Date() })
      .where(eq(schema.notificationQueue.id, id));

    this.logger.debug(`Marked notification ${id} as sent`);
  }

  /**
   * Mark notification as failed
   * 
   * @param id - Notification ID
   * @param error - Error message
   */
  async markAsFailed(id: string, error: string): Promise<void> {
    await this.db
      .update(schema.notificationQueue)
      .set({ status: NotificationStatus.FAILED, error, updatedAt: new Date() })
      .where(eq(schema.notificationQueue.id, id));

    this.logger.warn(`Marked notification ${id} as failed: ${error}`);
  }

  /**
   * Build reminder email content
   * 
   * @param dto - Schedule reminders DTO
   * @param timeBeforeTextCN - Time before text in Chinese (e.g., "3天", "1天", "3小时")
   * @param timeBeforeTextEN - Time before text in English (e.g., "3 days", "1 day", "3 hours")
   * @returns Email content
   */
  private buildReminderContent(
    dto: IScheduleRemindersDto,
    timeBeforeTextCN: string,
    timeBeforeTextEN: string,
  ): IEmailContent {
    const sessionType = dto.sessionInfo.sessionType || 'Regular Mentoring Session';
    const mentorName = dto.sessionInfo.mentorName || 'Mentor';
    const studentName = dto.sessionInfo.studentName || 'Student';
    const scheduledDate = new Date(dto.scheduledAt);
    
    // Format time in multiple timezones
    const formatTime = (tz: string) => {
      const date = scheduledDate.toLocaleString('en-US', { 
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return date.replace(',', '');
    };

    const endTime = new Date(scheduledDate.getTime() + dto.sessionInfo.duration * 60000);
    const formatTimeRange = (tz: string) => {
      const start = scheduledDate.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      const end = endTime.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
      return `${start} - ${end}`;
    };
    
    const html = `
      <html>
        <body>
          <h2>【Reminder】Your session will start in ${timeBeforeTextEN}</h2>
          <p>Hello,</p>
          <p>Your session will start in <strong>${timeBeforeTextEN}</strong>:</p>
          
          <p><strong>Date/Time (Timezone: PST):</strong> ${formatTimeRange('America/Los_Angeles')}<br/>
          <strong>Date/Time (Timezone: CST):</strong> ${formatTimeRange('America/Chicago')}<br/>
          <strong>Date/Time (Timezone: EST):</strong> ${formatTimeRange('America/New_York')}<br/>
          <strong>Date/Time (Timezone: UK):</strong> ${formatTimeRange('Europe/London')}<br/>
          <strong>Date/Time (Timezone: Shanghai):</strong> ${formatTimeRange('Asia/Shanghai')}</p>
          
          <p><strong>Session:</strong> ${dto.sessionInfo.title}<br/>
          <strong>Student:</strong> ${studentName}<br/>
          <strong>Mentor:</strong> ${mentorName}</p>
          
          <p><strong>Meeting URL:</strong> <a href="${dto.sessionInfo.meetingUrl}">${dto.sessionInfo.meetingUrl}</a><br/>
          You can join this meeting from your browser.</p>
          
          <br/>
          <p style="color: #666; font-size: 12px;">Powered by SuperAcademy</p>
        </body>
      </html>
    `;

    const text = `Session Reminder: Your session will start in ${timeBeforeTextEN}. Session: ${dto.sessionInfo.title}, Student: ${studentName}, Mentor: ${mentorName}, Meeting URL: ${dto.sessionInfo.meetingUrl}`;

    return { html, text };
  }

  /**
   * Send immediate notification (without queuing)
   * Used for error alerts and urgent notifications
   * 
   * @param params - Notification parameters
   */
  async sendImmediateNotification(params: {
    recipients: string[];
    subject: string;
    content: IEmailContent;
  }): Promise<void> {
    try {
      // Send email to each recipient
      for (const recipient of params.recipients) {
        await this.emailService.send({
          to: recipient,
          subject: params.subject,
          html: params.content.html,
        });
      }

      this.logger.log(
        `Sent immediate notification to ${params.recipients.length} recipient(s): ${params.subject}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send immediate notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }

  /**
   * Build error notification content
   * 
   * @param params - Error notification parameters
   * @returns Email content
   */
  buildErrorNotificationContent(params: {
    sessionId: string;
    operation: string;
    errorMessage: string;
    requireManualIntervention: boolean;
    sessionInfo?: {
      studentName?: string;
      mentorName?: string;
      scheduledAt?: Date | string;
    };
  }): IEmailContent {
    const scheduledAtStr = params.sessionInfo?.scheduledAt
      ? new Date(params.sessionInfo.scheduledAt).toLocaleString('en-US', {
          timeZone: 'Asia/Shanghai',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : 'N/A';

    const html = `
      <html>
        <body>
          <h2 style="color: #d32f2f;">⚠️ Session ${params.operation} Failed</h2>
          <p>Hello Counselor,</p>
          <p>A session operation has failed and requires your attention.</p>
          
          <h3>Error Details:</h3>
          <ul>
            <li><strong>Session ID:</strong> ${params.sessionId}</li>
            <li><strong>Operation:</strong> ${params.operation}</li>
            <li><strong>Error:</strong> ${params.errorMessage}</li>
            ${params.sessionInfo?.studentName ? `<li><strong>Student:</strong> ${params.sessionInfo.studentName}</li>` : ''}
            ${params.sessionInfo?.mentorName ? `<li><strong>Mentor:</strong> ${params.sessionInfo.mentorName}</li>` : ''}
            ${params.sessionInfo?.scheduledAt ? `<li><strong>Scheduled At:</strong> ${scheduledAtStr}</li>` : ''}
          </ul>
          
          ${params.requireManualIntervention ? `
          <p style="color: #d32f2f;"><strong>⚠️ Manual Intervention Required</strong></p>
          <p>Please check the system and take appropriate action.</p>
          ` : ''}
          
          <br/>
          <p style="color: #666; font-size: 12px;">Powered by SuperAcademy</p>
        </body>
      </html>
    `;

    const text = `Session ${params.operation} Failed - Session ID: ${params.sessionId}, Error: ${params.errorMessage}${params.requireManualIntervention ? ' - Manual intervention required' : ''}`;

    return { html, text };
  }

  /**
   * Map database row to entity
   * 
   * @param row - Database row
   * @returns Notification queue entity
   */
  private mapToEntity(row: any): INotificationQueueEntity {
    return {
      id: row.id,
      sessionId: row.sessionId || row.session_id,
      type: row.type as NotificationType,
      recipients: typeof row.recipients === 'string' ? JSON.parse(row.recipients) : row.recipients,
      subject: row.subject,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      reminderType: row.reminderType || row.reminder_type as ReminderType,
      scheduledSendTime: new Date(row.scheduledSendTime || row.scheduled_send_time),
      status: row.status as NotificationStatus,
      sentAt: row.sentAt || row.sent_at ? new Date(row.sentAt || row.sent_at) : undefined,
      error: row.error,
      createdAt: new Date(row.createdAt || row.created_at),
      updatedAt: new Date(row.updatedAt || row.updated_at),
    };
  }
}

