import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

/**
 * Notification Type Enum
 */
export const notificationTypeEnum = pgEnum("notification_type", [
  "email",
  "feishu_bot",
]);

/**
 * Notification Status Enum
 */
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "sent",
  "failed",
  "cancelled",
]);

/**
 * Reminder Type Enum
 * Defines when to send reminders before the scheduled session
 */
export const reminderTypeEnum = pgEnum("reminder_type", [
  "three_days",
  "one_day",
  "three_hours",
]);

/**
 * Notification Queue Table (Optimized for Regular Mentoring)
 *
 * Stores scheduled notifications with persistent queue management
 * Supports multi-recipient email notifications with reminder types
 */
export const notificationQueue = pgTable("notification_queue", {
  // Primary Key
  id: uuid("id").primaryKey().defaultRandom(),

  // Session Reference
  sessionId: uuid("session_id").notNull(),

  // Notification Details
  type: notificationTypeEnum("type").notNull(), // email | feishu_bot
  recipients: jsonb("recipients").notNull(), // Multiple recipients: {counselor: "c@x.com", mentor: "m@x.com", student: "s@x.com"}
  subject: varchar("subject", { length: 255 }).notNull(), // Email subject
  content: jsonb("content").notNull(), // Email content: {html: "...", text: "..."}
  reminderType: reminderTypeEnum("reminder_type"), // three_days | one_day | three_hours

  // Scheduling
  scheduledSendTime: timestamp("scheduled_send_time", { withTimezone: true }).notNull(), // When to send

  // Status Tracking
  status: notificationStatusEnum("status").notNull().default("pending"),
  sentAt: timestamp("sent_at", { withTimezone: true }), // When sent
  error: varchar("error", { length: 500 }), // Error message if failed

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Type inference
 */
export type NotificationQueue = typeof notificationQueue.$inferSelect;
export type NotificationQueueInsert = typeof notificationQueue.$inferInsert;
