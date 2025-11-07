import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { EmailModule } from "@core/email/email.module";
import { FeishuBotModule } from "@core/feishu/bot/feishu-bot.module";
import { NotificationService } from "./services/notification.service";
import { NotificationQueueService } from "./queue/notification-queue.service";
import { NotificationQueueRepository } from "./repositories/notification-queue.repository";
import { NotificationSchedulerWorker } from "./queue/notification-scheduler.worker";

/**
 * Notification Module
 *
 * Provides email and bot notification services
 * Includes queue management for scheduled notifications with database persistence
 */
@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(), // Enable cron jobs
    DatabaseModule, // Database connection
    EmailModule,
    FeishuBotModule,
  ],
  providers: [
    NotificationService,
    NotificationQueueService,
    NotificationQueueRepository,
    NotificationSchedulerWorker,
  ],
  exports: [
    NotificationService,
    NotificationQueueService,
    NotificationSchedulerWorker,
  ],
})
export class NotificationModule {}
