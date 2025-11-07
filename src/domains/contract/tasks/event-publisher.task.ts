import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { EventPublisherService } from "../services/event-publisher.service";
import { EVENT_PUBLISHER_POLL_INTERVAL_MS } from "../common/constants/contract.constants";

/**
 * Event Publisher Task
 * - Scheduled task to publish pending domain events
 * - Implements Outbox Pattern for reliable event delivery
 * - Runs every 30 seconds (configurable via EVENT_PUBLISHER_POLL_INTERVAL_MS)
 * - Calls EventPublisherService.processPendingEvents()
 *
 * Design Decisions:
 * - v2.16.8: Outbox pattern for reliable event publishing
 * - Poll interval: 30 seconds (default)
 * - Advisory lock prevents multi-instance conflicts
 * - Batch size: 100 events per poll
 * - Max retries: 3 attempts with exponential backoff
 */
@Injectable()
export class EventPublisherTask {
  private readonly logger = new Logger(EventPublisherTask.name);

  constructor(private readonly eventPublisherService: EventPublisherService) {}

  /**
   * Publish pending events
   * - Runs every 30 seconds (or custom interval from env)
   * - Processes up to 100 pending events per run
   * - Uses advisory lock to prevent concurrent processing
   * - Retries failed events up to max_retries
   */
  @Cron(`*/${EVENT_PUBLISHER_POLL_INTERVAL_MS / 1000} * * * * *`, {
    name: "event-publisher",
    timeZone: "UTC",
  })
  async handleEventPublishing(): Promise<void> {
    this.logger.debug("Starting event publishing task...");

    try {
      const publishedCount =
        await this.eventPublisherService.processPendingEvents();

      if (publishedCount > 0) {
        this.logger.log(`Published ${publishedCount} events`);
      }
    } catch (error) {
      this.logger.error(`Event publishing task failed: ${error}`);
      // Don't throw - let task continue on next schedule
    }
  }

  /**
   * Daily event statistics logging
   * - Runs at midnight UTC
   * - Logs event counts for monitoring
   */
  @Cron("0 0 * * *", {
    name: "event-stats",
    timeZone: "UTC",
  })
  async handleEventStats(): Promise<void> {
    try {
      const stats = await this.eventPublisherService.getEventStats();
      this.logger.log(
        `Event statistics: ${stats.pending} pending, ${stats.published} published, ${stats.failed} failed`,
      );
    } catch (error) {
      this.logger.error(`Event stats task failed: ${error}`);
    }
  }

  /**
   * Daily event cleanup
   * - Runs at 2 AM UTC
   * - Removes old published events (retention: 7 days)
   */
  @Cron("0 2 * * *", {
    name: "event-cleanup",
    timeZone: "UTC",
  })
  async handleEventCleanup(): Promise<void> {
    this.logger.log("Starting event cleanup task...");

    try {
      const deletedCount = await this.eventPublisherService.cleanupOldEvents();

      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old events`);
      } else {
        this.logger.debug("No old events to clean up");
      }
    } catch (error) {
      this.logger.error(`Event cleanup task failed: ${error}`);
    }
  }
}
