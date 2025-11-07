import { Injectable, Logger } from "@nestjs/common";
import { NotificationQueueService } from "./notification-queue.service";
import {
  QueueNotificationDto,
  NotificationType,
} from "../dto/queue-notification.dto";
import { ISessionEntity } from "@domains/services/session/interfaces/session.interface";

/**
 * Notification Schedule Configuration
 */
interface IScheduleConfig {
  daysBefore: number[]; // Days before session (e.g., [3] = 3 days before)
  hoursBefore: number[]; // Hours before session (e.g., [3, 1] = 3 hours and 1 hour before)
}

/**
 * Notification Scheduler Worker
 *
 * Automatically generates scheduled notifications for sessions
 * Creates reminder notifications at configurable intervals (e.g., 3 days, 3 hours, 1 hour before)
 */
@Injectable()
export class NotificationSchedulerWorker {
  private readonly logger = new Logger(NotificationSchedulerWorker.name);

  // Default schedule configuration
  private readonly defaultConfig: IScheduleConfig = {
    daysBefore: [3], // 3 days before
    hoursBefore: [3, 1], // 3 hours and 1 hour before
  };

  constructor(
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  /**
   * Schedule notifications for a newly created session
   *
   * @param session - Session entity
   * @param studentEmail - Student email address
   * @param mentorEmail - Mentor email address
   * @param config - Schedule configuration (optional)
   * @returns Array of notification IDs
   */
  async scheduleSessionNotifications(
    session: ISessionEntity,
    studentEmail: string,
    mentorEmail: string,
    config?: Partial<IScheduleConfig>,
  ): Promise<string[]> {
    this.logger.log(
      `Scheduling notifications for session: ${session.id}, scheduled time: ${session.scheduledStartTime.toISOString()}`,
    );

    const finalConfig: IScheduleConfig = {
      ...this.defaultConfig,
      ...config,
    };

    const notificationIds: string[] = [];

    // Schedule "days before" notifications
    for (const days of finalConfig.daysBefore) {
      const scheduledTime = this.calculateScheduledTime(
        session.scheduledStartTime,
        days,
        0,
      );

      // Only schedule if the notification time is in the future
      if (scheduledTime > new Date()) {
        const ids = await this.scheduleReminderNotifications(
          session,
          studentEmail,
          mentorEmail,
          scheduledTime,
          `${days}天前提醒`,
        );
        notificationIds.push(...ids);
      } else {
        this.logger.debug(
          `Skipping ${days}-day reminder (scheduled time is in the past)`,
        );
      }
    }

    // Schedule "hours before" notifications
    for (const hours of finalConfig.hoursBefore) {
      const scheduledTime = this.calculateScheduledTime(
        session.scheduledStartTime,
        0,
        hours,
      );

      // Only schedule if the notification time is in the future
      if (scheduledTime > new Date()) {
        const ids = await this.scheduleReminderNotifications(
          session,
          studentEmail,
          mentorEmail,
          scheduledTime,
          `${hours}小时前提醒`,
        );
        notificationIds.push(...ids);
      } else {
        this.logger.debug(
          `Skipping ${hours}-hour reminder (scheduled time is in the past)`,
        );
      }
    }

    this.logger.log(
      `Scheduled ${notificationIds.length} notifications for session: ${session.id}`,
    );

    return notificationIds;
  }

  /**
   * Schedule reminder notifications for student and mentor
   *
   * @param session - Session entity
   * @param studentEmail - Student email address
   * @param mentorEmail - Mentor email address
   * @param scheduledTime - When to send the notification
   * @param label - Label for logging
   * @returns Array of notification IDs
   */
  private async scheduleReminderNotifications(
    session: ISessionEntity,
    studentEmail: string,
    mentorEmail: string,
    scheduledTime: Date,
    label: string,
  ): Promise<string[]> {
    const notificationIds: string[] = [];

    const data = {
      sessionId: session.id,
      sessionName: session.sessionName,
      scheduledStartTime: session.scheduledStartTime.toLocaleString("zh-CN"),
      scheduledDuration: session.scheduledDuration,
      meetingUrl: session.meetingUrl || "",
      meetingPassword: session.meetingPassword || "",
      studentName: "学生", // TODO: Get from user service
      mentorName: "导师", // TODO: Get from user service
    };

    // Schedule notification for student
    const studentNotification: QueueNotificationDto = {
      sessionId: session.id,
      type: NotificationType.EMAIL,
      recipient: studentEmail,
      template: "session-reminder",
      data,
      scheduledTime,
    };

    const studentId =
      await this.notificationQueueService.enqueue(studentNotification);
    notificationIds.push(studentId);

    this.logger.debug(
      `Scheduled ${label} notification for student: ${studentEmail} at ${scheduledTime.toISOString()}`,
    );

    // Schedule notification for mentor
    const mentorNotification: QueueNotificationDto = {
      sessionId: session.id,
      type: NotificationType.EMAIL,
      recipient: mentorEmail,
      template: "session-reminder",
      data,
      scheduledTime,
    };

    const mentorId =
      await this.notificationQueueService.enqueue(mentorNotification);
    notificationIds.push(mentorId);

    this.logger.debug(
      `Scheduled ${label} notification for mentor: ${mentorEmail} at ${scheduledTime.toISOString()}`,
    );

    return notificationIds;
  }

  /**
   * Calculate scheduled notification time
   *
   * @param sessionStartTime - Session start time
   * @param daysBefore - Days before session
   * @param hoursBefore - Hours before session
   * @returns Scheduled notification time
   */
  private calculateScheduledTime(
    sessionStartTime: Date,
    daysBefore: number,
    hoursBefore: number,
  ): Date {
    const totalMilliseconds =
      (daysBefore * 24 * 60 + hoursBefore * 60) * 60 * 1000;

    return new Date(sessionStartTime.getTime() - totalMilliseconds);
  }

  /**
   * Reschedule notifications for a session (e.g., when session time is changed)
   *
   * @param session - Updated session entity
   * @param studentEmail - Student email address
   * @param mentorEmail - Mentor email address
   * @param config - Schedule configuration (optional)
   * @returns Array of new notification IDs
   */
  async rescheduleSessionNotifications(
    session: ISessionEntity,
    studentEmail: string,
    mentorEmail: string,
    config?: Partial<IScheduleConfig>,
  ): Promise<string[]> {
    this.logger.log(`Rescheduling notifications for session: ${session.id}`);

    // Cancel existing notifications
    await this.notificationQueueService.cancelBySessionId(session.id);

    // Schedule new notifications
    return this.scheduleSessionNotifications(
      session,
      studentEmail,
      mentorEmail,
      config,
    );
  }

  /**
   * Cancel all scheduled notifications for a session
   *
   * @param sessionId - Session ID
   * @returns Number of cancelled notifications
   */
  async cancelSessionNotifications(sessionId: string): Promise<number> {
    this.logger.log(`Cancelling all notifications for session: ${sessionId}`);

    return this.notificationQueueService.cancelBySessionId(sessionId);
  }

  /**
   * Schedule immediate notification (sent as soon as possible)
   *
   * @param session - Session entity
   * @param recipientEmail - Recipient email address
   * @param template - Email template name
   * @param data - Template data
   * @returns Notification ID
   */
  async scheduleImmediateNotification(
    session: ISessionEntity,
    recipientEmail: string,
    template: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    this.logger.log(
      `Scheduling immediate notification for session: ${session.id}, recipient: ${recipientEmail}`,
    );

    const notification: QueueNotificationDto = {
      sessionId: session.id,
      type: NotificationType.EMAIL,
      recipient: recipientEmail,
      template,
      data,
      scheduledTime: new Date(), // Send immediately
    };

    return this.notificationQueueService.enqueue(notification);
  }

  /**
   * Get custom schedule configuration from environment or config service
   *
   * @returns Schedule configuration
   */
  getCustomScheduleConfig(): IScheduleConfig {
    // This can be extended to read from ConfigService
    // For now, return default config
    return this.defaultConfig;
  }
}
