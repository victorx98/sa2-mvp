import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MeetingRepository } from "../repositories/meeting.repository";
import { MeetingEventRepository } from "../repositories/meeting-event.repository";
import { DurationCalculatorService } from "./duration-calculator.service";
import { DelayedTaskService } from "./delayed-task.service";
import { MeetingStatus } from "../entities/meeting.entity";
import {
  MeetingLifecycleCompletedEvent,
  MeetingStatusChangedEvent,
  MeetingRecordingReadyEvent,
} from "../events/meeting-lifecycle.events";
import type { Meeting } from "@infrastructure/database/schema/meetings.schema";

/**
 * Meeting Lifecycle Service
 *
 * Core state machine for meeting lifecycle management
 * Handles state transitions: scheduled -> active -> ended
 *
 * Query optimization:
 * - All queries by meeting_no MUST include time window constraint (7 days)
 */
@Injectable()
export class MeetingLifecycleService {
  private readonly logger = new Logger(MeetingLifecycleService.name);

  constructor(
    private readonly meetingRepo: MeetingRepository,
    private readonly eventRepo: MeetingEventRepository,
    private readonly durationCalculator: DurationCalculatorService,
    private readonly delayedTaskService: DelayedTaskService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle meeting started event
   *
   * Transitions meeting from 'scheduled' to 'active'
   *
   * @param meetingNo - Meeting number
   * @param occurredAt - Event occurrence time
   */
  async handleMeetingStarted(
    meetingNo: string,
    occurredAt: Date,
  ): Promise<void> {
    try {
      this.logger.debug(`Handling meeting started: ${meetingNo}`);

      // Find meeting within 7-day window
      const meeting = await this.meetingRepo.findByMeetingNoWithinWindow(
        meetingNo,
        occurredAt,
      );

      if (!meeting) {
        this.logger.warn(
          `Meeting ${meetingNo} not found for meeting_started event`,
        );
        return;
      }

      // Only transition if currently scheduled
      if (meeting.status !== MeetingStatus.SCHEDULED) {
        this.logger.debug(
          `Meeting ${meetingNo} already in status ${meeting.status}, skipping transition`,
        );
        return;
      }

      // Update status to active
      await this.meetingRepo.update(meeting.id, {
        status: MeetingStatus.ACTIVE,
        eventType: "meeting_started",
      });

      this.logger.log(`Meeting ${meetingNo} transitioned to ACTIVE`);

      // Emit status changed event
      this.eventEmitter.emit(
        "meeting.status.changed",
        new MeetingStatusChangedEvent(
          meeting.id,
          meetingNo,
          MeetingStatus.SCHEDULED,
          MeetingStatus.ACTIVE,
          occurredAt,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Error handling meeting started for ${meetingNo}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle meeting ended event
   *
   * Starts delayed detection task (30 minutes) to check for meeting completion
   * This handles the "meeting restart" scenario
   *
   * @param meetingNo - Meeting number
   * @param occurredAt - Event occurrence time
   */
  async handleMeetingEnded(
    meetingNo: string,
    occurredAt: Date,
  ): Promise<void> {
    try {
      this.logger.debug(`Handling meeting ended: ${meetingNo}`);

      // Find meeting within 7-day window
      const meeting = await this.meetingRepo.findByMeetingNoWithinWindow(
        meetingNo,
        occurredAt,
      );

      if (!meeting) {
        this.logger.warn(
          `Meeting ${meetingNo} not found for meeting_ended event`,
        );
        return;
      }

      // Cancel any existing pending task
      if (meeting.pendingTaskId) {
        await this.delayedTaskService.cancelTask(meeting.pendingTaskId);
      }

      // Schedule delayed completion check (30 minutes)
      const taskId = await this.delayedTaskService.scheduleCompletionCheck(
        meeting.id,
        meetingNo,
        occurredAt,
      );

      // Update meeting with last ended timestamp and task ID
      await this.meetingRepo.update(meeting.id, {
        lastMeetingEndedTimestamp: occurredAt,
        pendingTaskId: taskId,
        eventType: "meeting_ended",
      });

      this.logger.log(
        `Scheduled delayed completion check for meeting ${meetingNo} (task: ${taskId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling meeting ended for ${meetingNo}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Finalize meeting (called by delayed task)
   *
   * Flow:
   * 1. Check if new join events occurred after last ended timestamp
   * 2. If yes, reschedule check
   * 3. If no, calculate duration and finalize meeting
   * 4. Publish MeetingLifecycleCompletedEvent
   *
   * @param meetingId - Meeting UUID
   * @param meetingNo - Meeting number
   * @param lastEndedTimestamp - Last meeting.ended event timestamp
   */
  async finalizeMeeting(
    meetingId: string,
    meetingNo: string,
    lastEndedTimestamp: Date,
  ): Promise<void> {
    try {
      this.logger.debug(`Finalizing meeting: ${meetingNo}`);

      const meeting = await this.meetingRepo.findById(meetingId);

      if (!meeting) {
        this.logger.warn(`Meeting ${meetingId} not found for finalization`);
        return;
      }

      // Check for new join events after last ended timestamp
      const hasNewJoinEvents = await this.eventRepo.hasNewJoinEventsAfter(
        meetingNo,
        lastEndedTimestamp,
      );

      if (hasNewJoinEvents) {
        this.logger.log(
          `New join events detected for meeting ${meetingNo}, rescheduling check`,
        );

        // Reschedule another check
        const taskId = await this.delayedTaskService.scheduleCompletionCheck(
          meetingId,
          meetingNo,
          new Date(), // Use current time as new reference
        );

        await this.meetingRepo.update(meetingId, {
          pendingTaskId: taskId,
        });

        return;
      }

      // No new events - finalize meeting
      await this.completeMeeting(meeting);
    } catch (error) {
      this.logger.error(
        `Error finalizing meeting ${meetingNo}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Complete meeting (internal method)
   *
   * @param meeting - Meeting entity
   */
  private async completeMeeting(meeting: Meeting): Promise<void> {
    this.logger.debug(`Completing meeting: ${meeting.meetingNo}`);

      // Fetch all events for duration calculation
      const allEvents = await this.eventRepo.findByMeetingNo(meeting.meetingNo);

      // Calculate duration and time segments
      const { durationSeconds, timeSegments } =
        this.durationCalculator.calculateDuration(
          allEvents as any, // Cast to any to bypass type check
        );

    // Validate duration
    const isValidDuration = this.durationCalculator.validateDuration(
      durationSeconds,
      meeting.scheduleDuration,
    );

    if (!isValidDuration) {
      this.logger.warn(
        `Invalid duration calculated for meeting ${meeting.meetingNo}: ${durationSeconds}s`,
      );
    }

    // Update meeting to ended status
    // Convert time segments from Date to ISO string format for database storage
    const dbTimeSegments = timeSegments.map((seg) => ({
      start: seg.start instanceof Date ? seg.start.toISOString() : seg.start,
      end: seg.end instanceof Date ? seg.end.toISOString() : seg.end,
    }));

    await this.meetingRepo.update(meeting.id, {
      status: MeetingStatus.ENDED,
      actualDuration: durationSeconds,
      meetingTimeList: dbTimeSegments,
      pendingTaskId: null,
      eventType: "completed",
    });

    this.logger.log(
      `Meeting ${meeting.meetingNo} completed with duration ${durationSeconds}s`,
    );

    // Publish lifecycle completed event for downstream domains
    const completedEvent = new MeetingLifecycleCompletedEvent(
      meeting.id,
      meeting.meetingNo,
      meeting.meetingProvider,
      meeting.scheduleStartTime,
      durationSeconds,
      meeting.recordingUrl,
      new Date(),
      timeSegments,
    );

    this.eventEmitter.emit("meeting.lifecycle.completed", completedEvent);

    this.logger.log(
      `Published MeetingLifecycleCompletedEvent for meeting ${meeting.id}`,
    );
  }

  /**
   * Handle recording ready event
   *
   * Updates meeting with recording URL
   *
   * @param meetingNo - Meeting number
   * @param recordingUrl - Recording URL
   */
  async handleRecordingReady(
    meetingNo: string,
    recordingUrl: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Handling recording ready: ${meetingNo}`);

      // Find meeting within 7-day window
      const meeting = await this.meetingRepo.findByMeetingNoWithinWindow(
        meetingNo,
        new Date(),
      );

      if (!meeting) {
        this.logger.warn(
          `Meeting ${meetingNo} not found for recording_ready event`,
        );
        return;
      }

      // Update recording URL
      await this.meetingRepo.update(meeting.id, {
        recordingUrl,
        eventType: "recording_ready",
      });

      this.logger.log(`Recording URL updated for meeting ${meetingNo}`);

      // Emit recording ready event
      this.eventEmitter.emit(
        "meeting.recording.ready",
        new MeetingRecordingReadyEvent(
          meeting.id,
          meetingNo,
          recordingUrl,
          new Date(),
        ),
      );
    } catch (error) {
      this.logger.error(
        `Error handling recording ready for ${meetingNo}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}

