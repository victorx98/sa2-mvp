import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ServiceHoldService } from "../services/service-hold.service";
import { HOLD_CLEANUP_CRON } from "../common/constants/contract.constants";

/**
 * Hold Cleanup Task
 * - Scheduled task to expire active holds past their TTL
 * - Runs every 5 minutes (configurable via HOLD_CLEANUP_CRON)
 * - Calls ServiceHoldService.expireHolds()
 * - Triggers automatically update held_quantity in entitlements
 *
 * Design Decisions:
 * - v2.16.5: Decision #5 - TTL mechanism with automatic cleanup
 * - Default TTL: 15 minutes
 * - Cleanup frequency: Every 5 minutes
 * - Status transition: active -> expired
 */
@Injectable()
export class HoldCleanupTask {
  private readonly logger = new Logger(HoldCleanupTask.name);

  constructor(private readonly serviceHoldService: ServiceHoldService) {}

  /**
   * Cleanup expired holds
   * - Runs every 5 minutes (or custom cron from env)
   * - Updates holds with expires_at < now to status=expired
   * - Triggers automatically adjust held_quantity and available_quantity
   */
  @Cron(HOLD_CLEANUP_CRON, {
    name: "hold-cleanup",
    timeZone: "UTC",
  })
  async handleCleanup(): Promise<void> {
    this.logger.log("Starting hold cleanup task...");

    try {
      const expiredCount = await this.serviceHoldService.expireHolds();

      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} holds`);
      } else {
        this.logger.debug("No expired holds found");
      }
    } catch (error) {
      this.logger.error(`Hold cleanup task failed: ${error}`);
      // Don't throw - let task continue on next schedule
    }
  }
}
