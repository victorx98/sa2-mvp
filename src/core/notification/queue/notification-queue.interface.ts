import { NotificationType } from "../dto/queue-notification.dto";

/**
 * Queued Notification Interface
 */
export interface IQueuedNotification {
  id: string; // Unique notification ID
  sessionId: string; // Associated session ID
  type: NotificationType; // Notification type
  recipient: string; // Recipient (email or feishu user_id)
  template: string; // Template name
  data: Record<string, unknown>; // Template data
  scheduledTime: Date; // Scheduled send time
  status: "pending" | "sent" | "failed" | "cancelled"; // Notification status
  createdAt: Date; // Creation time
  sentAt?: Date; // Sent time
  error?: string; // Error message if failed
}
