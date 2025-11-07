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
 * Notification Queue Table
 *
 * Stores scheduled notifications with persistent queue management
 */
export const notificationQueue = pgTable("notification_queue", {
  // Primary Key
  id: uuid("id").primaryKey().defaultRandom(),

  // Session Reference
  sessionId: uuid("session_id").notNull(),

  // Notification Details
  type: notificationTypeEnum("type").notNull(), // email | feishu_bot
  recipient: varchar("recipient", { length: 255 }).notNull(), // Email or Feishu user_id
  template: varchar("template", { length: 100 }).notNull(), // Template name
  data: jsonb("data").notNull(), // Template data

  // Scheduling
  scheduledTime: timestamp("scheduled_time", { withTimezone: true }).notNull(), // When to send

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
