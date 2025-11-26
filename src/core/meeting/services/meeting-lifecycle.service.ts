import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MeetingRepository } from "../repositories/meeting.repository";
import { MeetingEventRepository } from "../repositories/meeting-event.repository";
import { DurationCalculatorService } from "./duration-calculator.service";
import { DelayedTaskService } from "./delayed-task.service";
import { MeetingStatus } from "../entities/meeting.entity";
import {
  MeetingLifecycleCompletedPayload,
  MeetingRecordingReadyPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
  MEETING_RECORDING_READY_EVENT,
  MeetingTimeSegment,
} from "@shared/events";
import { MeetingStatusChangedEvent } from "../events/meeting-lifecycle.events";
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
   * Handle meeting started event (v4.2 optimized)
   *
   * Transitions meeting from 'scheduled' to 'active'
   * If meeting was previously ended (with pending completion task), cancels the task
   * This handles the "meeting restart" scenario immediately
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

      // Cancel pending completion task if exists (meeting restart scenario)
      if (meeting.pendingTaskId) {
        this.logger.log(
          `Meeting ${meetingNo} restarted, cancelling pending completion task ${meeting.pendingTaskId}`,
        );
        await this.delayedTaskService.cancelTask(meeting.pendingTaskId);
      }

      // Determine previous status for event emission
      const previousStatus = meeting.status;

      // Update status to active and clear pending task
      await this.meetingRepo.update(meeting.id, {
        status: MeetingStatus.ACTIVE,
        pendingTaskId: null, // Clear pending task on restart
      });

      this.logger.log(
        `Meeting ${meetingNo} transitioned to ACTIVE (previous: ${previousStatus})`,
      );

      // Emit status changed event
      this.eventEmitter.emit(
        "meeting.status.changed",
        new MeetingStatusChangedEvent(
          meeting.id,
          meetingNo,
          previousStatus,
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
   * Handle meeting ended event (v4.2 optimized)
   *
   * Immediately calculates and stores duration from the latest meeting_ended event,
   * then schedules delayed completion check (30 minutes) for final confirmation
   *
   * Duration calculation is done once here - delayed task only confirms meeting completion
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

      // Cancel any existing pending task (from previous ended event)
      if (meeting.pendingTaskId) {
        this.logger.debug(
          `Cancelling previous completion task ${meeting.pendingTaskId}`,
        );
        await this.delayedTaskService.cancelTask(meeting.pendingTaskId);
      }

      // Calculate duration from all meeting segments
      const durationData = await this.calculateDurationFromEvents(meetingNo);

      // Schedule delayed completion check (30 minutes)
      const taskId = await this.delayedTaskService.scheduleCompletionCheck(
        meeting.id,
        meetingNo,
        occurredAt,
      );

      // Update meeting with calculated duration and new task ID
      await this.meetingRepo.update(meeting.id, {
        lastMeetingEndedTimestamp: occurredAt,
        pendingTaskId: taskId,
        ...(durationData.actualDuration !== null && {
          actualDuration: durationData.actualDuration,
        }),
        ...(durationData.meetingTimeList && {
          meetingTimeList: durationData.meetingTimeList,
        }),
      });

      this.logger.log(
        `Meeting ${meetingNo} updated with duration: ${durationData.actualDuration}s, scheduled completion check (task: ${taskId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling meeting ended for ${meetingNo}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Finalize meeting (called by delayed task) - v4.2 optimized
   *
   * Simplified flow:
   * 1. Check if taskId matches current pendingTaskId (task validity check)
   * 2. If mismatch, task is outdated (cancelled by meeting_started or new meeting_ended)
   * 3. If match, meeting truly ended - mark as completed and publish event
   *
   * Duration calculation is already done in handleMeetingEnded - no recalculation needed
   *
   * @param meetingId - Meeting UUID
   * @param meetingNo - Meeting number
   * @param lastEndedTimestamp - Last meeting.ended event timestamp (kept for logging)
   * @param taskId - Task ID for verification
   */
  async finalizeMeeting(
    meetingId: string,
    meetingNo: string,
    lastEndedTimestamp: Date,
    taskId: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Finalizing meeting: ${meetingNo} (task: ${taskId})`);

      const meeting = await this.meetingRepo.findById(meetingId);

      if (!meeting) {
        this.logger.warn(`Meeting ${meetingId} not found for finalization`);
        return;
      }

      // Check if task is still valid (not cancelled or replaced)
      if (meeting.pendingTaskId !== taskId) {
        this.logger.log(
          `Task ${taskId} is outdated for meeting ${meetingNo} ` +
          `(current pendingTaskId: ${meeting.pendingTaskId}). ` +
          `Meeting was likely restarted or already completed. Skipping finalization.`,
        );
        return;
      }

      // Task is valid - meeting truly ended, mark as completed
      await this.completeMeeting(meeting);
    } catch (error) {
      this.logger.error(
        `Error finalizing meeting ${meetingNo}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Calculate duration from meeting_ended events (v4.2 optimized)
   * 
   * Extracts duration directly from meeting_ended event's start_time and end_time
   * This is the single source of truth - no fallback to join/leave events
   *
   * @param meetingNo - Meeting number
   * @returns Calculated duration and time segments
   */
  private async calculateDurationFromEvents(
    meetingNo: string,
  ): Promise<{
    actualDuration: number | null;
    meetingTimeList: Array<{ start: string; end: string }> | null;
  }> {
    try {
      // Fetch all events
      const allEvents = await this.eventRepo.findByMeetingNo(meetingNo);

      if (allEvents.length === 0) {
        this.logger.warn(
          `No events found for ${meetingNo}, cannot calculate duration`,
        );
        return { actualDuration: null, meetingTimeList: null };
      }

      // Find all meeting_ended events
      const endedEvents = allEvents.filter(
        (e) =>
          e.eventType === "vc.meeting.meeting_ended_v1" ||
          e.eventType === "meeting.ended",
      );

      if (endedEvents.length === 0) {
        this.logger.warn(
          `No meeting_ended events found for ${meetingNo}, cannot calculate duration`,
        );
        return { actualDuration: null, meetingTimeList: null };
      }

      // Extract time segments from all meeting_ended events (supports meeting restart)
      const timeSegments: Array<{ start: string; end: string }> = [];
      let totalDuration = 0;

      for (const endedEvent of endedEvents) {
        const segment = this.extractTimeSegmentFromEvent(endedEvent);
        if (segment) {
          timeSegments.push(segment);
          totalDuration += segment.durationSeconds;
        }
      }

      if (timeSegments.length === 0) {
        this.logger.warn(
          `Could not extract time segments from meeting_ended events for ${meetingNo}`,
        );
        return { actualDuration: null, meetingTimeList: null };
      }

      this.logger.debug(
        `Calculated duration for ${meetingNo}: ${totalDuration}s from ${timeSegments.length} segment(s)`,
      );

      return {
        actualDuration: totalDuration,
        meetingTimeList: timeSegments.map(({ start, end }) => ({ start, end })),
      };
    } catch (error) {
      this.logger.error(
        `Error calculating duration for ${meetingNo}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { actualDuration: null, meetingTimeList: null };
    }
  }

  /**
   * Extract time segment from a single meeting_ended event
   * 
   * @param event - Meeting ended event
   * @returns Time segment with duration, or null if extraction fails
   */
  private extractTimeSegmentFromEvent(event: any): {
    start: string;
    end: string;
    durationSeconds: number;
  } | null {
    try {
      const eventData = event.eventData as any;
      const meeting = eventData?.event?.meeting || eventData?.payload?.object;

      if (!meeting) {
        this.logger.warn(
          `No meeting data in event ${event.eventId}, event may be malformed`,
        );
        return null;
      }

      const startTime = meeting.start_time;
      const endTime = meeting.end_time;

      if (!startTime || !endTime) {
        this.logger.warn(
          `Missing start_time or end_time in event ${event.eventId}, platform webhook may be incomplete`,
        );
        return null;
      }

      // Convert Unix timestamps (seconds) to Date objects
      const startDate = new Date(Number(startTime) * 1000);
      const endDate = new Date(Number(endTime) * 1000);

      // Calculate duration in seconds
      const durationSeconds = Math.floor(
        (endDate.getTime() - startDate.getTime()) / 1000,
      );

      if (durationSeconds < 0) {
        this.logger.error(
          `Invalid duration (negative) in event ${event.eventId}: ${durationSeconds}s`,
        );
        return null;
      }

      return {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        durationSeconds,
      };
    } catch (error) {
      this.logger.error(
        `Error extracting time segment from event: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Complete meeting (internal method) - v4.2 optimized
   *
   * Only updates status and publishes completion event
   * Duration calculation is already done in handleMeetingEnded - no recalculation needed
   *
   * @param meeting - Meeting entity
   */
  private async completeMeeting(meeting: Meeting): Promise<void> {
    this.logger.debug(`Completing meeting: ${meeting.meetingNo}`);

    // Validate that duration was already calculated
    if (!meeting.actualDuration || !meeting.meetingTimeList) {
      this.logger.warn(
        `Meeting ${meeting.meetingNo} has no duration data. This should not happen.`,
      );
    }

    // Validate duration against scheduled duration
    if (meeting.actualDuration) {
    const isValidDuration = this.durationCalculator.validateDuration(
        meeting.actualDuration,
      meeting.scheduleDuration,
    );

    if (!isValidDuration) {
      this.logger.warn(
          `Invalid duration for meeting ${meeting.meetingNo}: ${meeting.actualDuration}s (scheduled: ${meeting.scheduleDuration} minutes)`,
        );
      }
    }

    // Update meeting status to ended and clear pending task
    await this.meetingRepo.update(meeting.id, {
      status: MeetingStatus.ENDED,
      pendingTaskId: null,
    });

    this.logger.log(
      `Meeting ${meeting.meetingNo} marked as completed (duration: ${meeting.actualDuration}s)`,
    );

    // Publish lifecycle completed event for downstream domains 
    const completedPayload: MeetingLifecycleCompletedPayload = {
      meetingId: meeting.id,
      meetingNo: meeting.meetingNo,
      provider: meeting.meetingProvider,
      status: "ended",
      scheduleStartTime: meeting.scheduleStartTime,
      scheduleDuration: meeting.scheduleDuration,
      actualDuration: meeting.actualDuration || 0,
      endedAt: new Date(),
      timeList: (meeting.meetingTimeList as MeetingTimeSegment[]) || [],
      recordingUrl: meeting.recordingUrl,
    };

    this.eventEmitter.emit(
      MEETING_LIFECYCLE_COMPLETED_EVENT,
      completedPayload,
    );

    this.logger.log(
      `Published meeting.lifecycle.completed event for meeting ${meeting.id}`,
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
      });

      this.logger.log(`Recording URL updated for meeting ${meetingNo}`);

      // Emit recording ready event 
      const recordingPayload: MeetingRecordingReadyPayload = {
        meetingId: meeting.id,
        meetingNo,
        recordingUrl,
        readyAt: new Date(),
      };

      this.eventEmitter.emit(
        MEETING_RECORDING_READY_EVENT,
        recordingPayload,
      );
    } catch (error) {
      this.logger.error(
        `Error handling recording ready for ${meetingNo}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}

