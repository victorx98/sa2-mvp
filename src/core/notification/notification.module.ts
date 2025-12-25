import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationQueueService } from './services/notification-queue.service';
import { NotificationSchedulerService } from './services/notification-scheduler.service';
import { EmailModule } from '@core/email';

/**
 * Notification Module
 * 
 * Provides notification queue management and scheduled notification sending
 * Includes:
 * - NotificationQueueService: Queue management (CRUD operations)
 * - NotificationSchedulerService: Cron-based notification sender
 */
@Module({
  imports: [
    ScheduleModule.forRoot(), // Enable cron jobs
    EmailModule,
  ],
  providers: [
    NotificationQueueService,
    NotificationSchedulerService,
  ],
  exports: [
    NotificationQueueService,
    NotificationSchedulerService,
  ],
})
export class NotificationModule {}

