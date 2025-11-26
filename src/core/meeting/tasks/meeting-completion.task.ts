import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { MeetingRepository } from "../repositories/meeting.repository";
import { MeetingStatus } from "../entities/meeting.entity";

/**
 * Meeting Completion Task
 *
 * Background task to handle meeting cleanup and expiration
 * Runs periodically to find and expire stale meetings
 */
@Injectable()
export class MeetingCompletionTask {
  private readonly logger = new Logger(MeetingCompletionTask.name);

  constructor(private readonly meetingRepo: MeetingRepository) {}

  /**
   * Expire stale scheduled meetings
   *
   * Runs every hour to find meetings that:
   * - Status is 'scheduled'
   * - Scheduled start time is more than 24 hours in the past
   * - No meeting_started event was received
   *
   * These meetings are marked as 'expired'
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireStaleMeetings(): Promise<void> {
    try {
      this.logger.debug("Running stale meeting expiration task");

      const scheduledMeetings = await this.meetingRepo.findByStatus(
        MeetingStatus.SCHEDULED,
        1000, // Process up to 1000 meetings at a time
      );

      const now = new Date();
      const expirationThreshold = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

      let expiredCount = 0;

      for (const meeting of scheduledMeetings) {
        const timeSinceScheduled =
          now.getTime() - meeting.scheduleStartTime.getTime();

        if (timeSinceScheduled > expirationThreshold) {
          // Meeting is stale - mark as cancelled (v4.1)
          await this.meetingRepo.update(meeting.id, {
            status: MeetingStatus.CANCELLED,
          });

          this.logger.debug(
            `Expired stale meeting: ${meeting.id} (${meeting.meetingNo})`,
          );
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        this.logger.log(`Expired ${expiredCount} stale meeting(s)`);
      }
    } catch (error) {
      this.logger.error(
        `Error expiring stale meetings: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Cleanup old completed meetings (optional)
   *
   * Runs daily to archive or cleanup meetings older than 90 days
   * This is for data retention management
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldMeetings(): Promise<void> {
    try {
      this.logger.debug("Running old meeting cleanup task");

      // TODO: Implement archival logic if needed
      // For now, just log the task execution

      this.logger.log("Old meeting cleanup task completed");
    } catch (error) {
      this.logger.error(
        `Error cleaning up old meetings: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

