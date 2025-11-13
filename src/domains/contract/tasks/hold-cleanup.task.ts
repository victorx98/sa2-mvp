import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ServiceHoldService } from "@domains/contract/services/service-hold.service";

/**
 * Service Hold Expiry Task (v2.16.10)
 * - Automatically releases expired holds every hour
 * - Implements optional expiry with automatic cleanup
 * - Hybrid approach: scheduled cleanup + manual trigger
 *
 * Design decisions:
 * - Runs hourly to balance timeliness and system load
 * - Processes in batches (100 per batch) to avoid long transactions
 * - Each hold is released in its own transaction for isolation
 * - Logs detailed statistics for monitoring
 */
@Injectable()
export class ServiceHoldExpiryTask {
  constructor(
    private readonly serviceHoldService: ServiceHoldService,
    private readonly logger: Logger,
  ) {}

  /**
   * Scheduled task: Release expired holds every hour
   * - Cron: 0 * * * * (at the start of every hour)
   * - Batch size: 100 per execution
   * - Continues processing until no more expired holds found
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron(): Promise<void> {
    this.logger.log("Starting hourly expired holds cleanup task");

    let totalReleased = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let batchCount = 0;

    /* Process in batches until no more expired holds found */
    while (true) {
      batchCount++;
      this.logger.debug(
        `Processing batch ${batchCount} (limit: 100 per batch)`,
      );

      const result = await this.serviceHoldService.releaseExpiredHolds(100);

      totalReleased += result.releasedCount;
      totalFailed += result.failedCount;
      totalSkipped += result.skippedCount;

      this.logger.debug(
        `Batch ${batchCount} completed: released=${result.releasedCount}, failed=${result.failedCount}, skipped=${result.skippedCount}`,
      );

      /* Stop if no more holds processed in this batch */
      if (
        result.releasedCount === 0 &&
        result.failedCount === 0 &&
        result.skippedCount === 0
      ) {
        break;
      }

      /* Optional: Add small delay between batches to avoid overwhelming the database */
      if (
        result.releasedCount > 0 ||
        result.failedCount > 0 ||
        result.skippedCount > 0
      ) {
        await this.delay(100); // 100ms delay
      }
    }

    this.logger.log(
      `Expired holds cleanup completed: totalBatches=${batchCount}, totalReleased=${totalReleased}, totalFailed=${totalFailed}, totalSkipped=${totalSkipped}`,
    );

    /* Log warning if there were failures */
    if (totalFailed > 0) {
      this.logger.warn(
        `${totalFailed} expired holds failed to release during cleanup`,
      );
    }
  }

  /**
   * Manual trigger for immediate expired hold cleanup
   * - Can be called by admin API or other services
   * - Useful for testing or immediate cleanup needs
   */
  async triggerCleanup(batchSize = 100): Promise<{
    releasedCount: number;
    failedCount: number;
    skippedCount: number;
  }> {
    this.logger.log(
      `Manual trigger: releasing expired holds (batchSize: ${batchSize})`,
    );

    const result = await this.serviceHoldService.releaseExpiredHolds(batchSize);

    this.logger.log(
      `Manual cleanup completed: released=${result.releasedCount}, failed=${result.failedCount}, skipped=${result.skippedCount}`,
    );

    return result;
  }

  /**
   * Delay helper for async sleep
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
