/**
 * Reminder Type Enum
 */
export enum ReminderType {
  THREE_DAYS = 'three_days',
  ONE_DAY = 'one_day',
  THREE_HOURS = 'three_hours',
}

/**
 * Notification Status Enum
 */
export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Notification Type Enum
 */
export enum NotificationType {
  EMAIL = 'email',
  FEISHU_BOT = 'feishu_bot',
}

/**
 * Email Recipients Interface
 */
export interface IEmailRecipients {
  counselor?: string;
  mentor?: string;
  student?: string;
}

/**
 * Email Content Interface
 */
export interface IEmailContent {
  html: string;
  text?: string;
}

/**
 * Schedule Reminders DTO
 */
export interface IScheduleRemindersDto {
  sessionId: string;
  scheduledAt: Date;
  recipients: {
    counselorEmail?: string;
    mentorEmail: string;
    studentEmail: string;
  };
  sessionInfo: {
    title: string;
    meetingUrl: string;
    duration: number;
    sessionType?: string; // e.g., "Regular Mentoring Session", "Career Counseling"
    mentorName?: string;
    studentName?: string;
  };
}

/**
 * Notification Queue Entity Interface
 */
export interface INotificationQueueEntity {
  id: string;
  sessionId: string;
  type: NotificationType;
  recipients: IEmailRecipients;
  subject: string;
  content: IEmailContent;
  reminderType?: ReminderType;
  scheduledSendTime: Date;
  status: NotificationStatus;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

