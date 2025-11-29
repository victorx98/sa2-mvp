import { Injectable, Logger, Optional } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { MeetingLifecycleService } from "./meeting-lifecycle.service";
import { MEETING_COMPLETION_CHECK_DELAY_MINUTES } from "../../../constants";

/**
 * Delayed Task Service
 *
 * Manages delayed completion detection tasks
 * Uses Node.js setTimeout for scheduling (can be replaced with Redis/Bull queue for production)
 */
@Injectable()
export class DelayedTaskService {
  private readonly logger = new Logger(DelayedTaskService.name);
  private readonly DELAY_MINUTES = MEETING_COMPLETION_CHECK_DELAY_MINUTES;

  // In-memory task storage (for simple implementation)
  // Production: Replace with Redis or message queue
  private readonly taskMap = new Map<
    string,
    {
      timeout: NodeJS.Timeout;
      meetingId: string;
      meetingNo: string;
      scheduledAt: Date;
    }
  >();

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    // Note: We use @Optional() to avoid circular dependency
    // Lifecycle service is set manually via setLifecycleService() in MeetingModule constructor
    @Optional() private lifecycleService?: MeetingLifecycleService,
  ) {}

  /**
   * Set lifecycle service (to avoid circular dependency)
   */
  setLifecycleService(service: MeetingLifecycleService): void {
    this.lifecycleService = service;
  }

  /**
   * Schedule a completion check task
   *
   * @param meetingId - Meeting UUID
   * @param meetingNo - Meeting number
   * @param lastEndedTimestamp - Last meeting.ended event timestamp
   * @returns Task ID
   */
  async scheduleCompletionCheck(
    meetingId: string,
    meetingNo: string,
    lastEndedTimestamp: Date,
  ): Promise<string> {
    const taskId = `completion-check-${meetingId}-${Date.now()}`;
    const delayMs = this.DELAY_MINUTES * 60 * 1000; // Convert to milliseconds

    this.logger.debug(
      `Scheduling completion check for meeting ${meetingNo} in ${this.DELAY_MINUTES} minutes (task: ${taskId})`,
    );

    // Create timeout
    const timeout = setTimeout(async () => {
      try {
        this.logger.log(
          `Executing delayed completion check for meeting ${meetingNo} (task: ${taskId})`,
        );

        // Call lifecycle service to finalize meeting
        if (this.lifecycleService) {
          await this.lifecycleService.finalizeMeeting(
            meetingId,
            meetingNo,
            lastEndedTimestamp,
            taskId, // v4.2: Pass taskId for verification
          );
        } else {
          this.logger.error(
            "Lifecycle service not set, cannot execute completion check",
          );
        }

        // Clean up task from map
        this.taskMap.delete(taskId);
      } catch (error) {
        this.logger.error(
          `Error executing completion check for meeting ${meetingNo}: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.taskMap.delete(taskId);
      }
    }, delayMs);

    // Store task info
    this.taskMap.set(taskId, {
      timeout,
      meetingId,
      meetingNo,
      scheduledAt: new Date(),
    });

    // Register with scheduler (for monitoring)
    try {
      this.schedulerRegistry.addTimeout(taskId, timeout);
    } catch (error) {
      this.logger.warn(
        `Failed to register timeout with scheduler: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return taskId;
  }

  /**
   * Cancel a scheduled task
   *
   * @param taskId - Task ID to cancel
   * @returns True if task was cancelled
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.taskMap.get(taskId);

    if (!task) {
      this.logger.debug(`Task ${taskId} not found (may have already executed)`);
      return false;
    }

    this.logger.debug(
      `Cancelling completion check task ${taskId} for meeting ${task.meetingNo}`,
    );

    // Clear timeout
    clearTimeout(task.timeout);

    // Remove from scheduler registry
    try {
      this.schedulerRegistry.deleteTimeout(taskId);
    } catch (error) {
      // Task may not be in registry, ignore error
    }

    // Remove from map
    this.taskMap.delete(taskId);

    return true;
  }

  /**
   * Get task info (for debugging)
   *
   * @param taskId - Task ID
   * @returns Task info if exists
   */
  getTaskInfo(taskId: string): {
    meetingId: string;
    meetingNo: string;
    scheduledAt: Date;
  } | null {
    const task = this.taskMap.get(taskId);
    if (!task) {
      return null;
    }

    return {
      meetingId: task.meetingId,
      meetingNo: task.meetingNo,
      scheduledAt: task.scheduledAt,
    };
  }

  /**
   * Get all pending tasks (for monitoring)
   *
   * @returns Array of pending task IDs
   */
  getPendingTasks(): string[] {
    return Array.from(this.taskMap.keys());
  }

  /**
   * Cleanup all tasks (for shutdown)
   */
  async cleanup(): Promise<void> {
    this.logger.log(`Cleaning up ${this.taskMap.size} pending tasks`);

    for (const [taskId, task] of this.taskMap.entries()) {
      clearTimeout(task.timeout);
      try {
        this.schedulerRegistry.deleteTimeout(taskId);
      } catch {
        // Ignore errors
      }
    }

    this.taskMap.clear();
  }
}

