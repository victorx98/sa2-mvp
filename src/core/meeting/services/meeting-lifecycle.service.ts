import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { MeetingRepository } from "../repositories/meeting.repository";
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
import type { MeetingTimeSegment as TimeSegment } from "../adapters/event-adapter.interface";

/**
 * Meeting Lifecycle Service
 *
 * Core state machine for meeting lifecycle management
 * Handles state transitions: scheduled -> active -> ended
 *
 * Query optimization (v4.4):
 * - Use meeting_id (unique & permanent) for event lookups instead of meeting_no
 * - Direct index lookup, no time window constraints needed
 */
@Injectable()
export class MeetingLifecycleService {
  private readonly logger = new Logger(MeetingLifecycleService.name);

  constructor(
    private readonly meetingRepo: MeetingRepository,
    private readonly durationCalculator: DurationCalculatorService,
    private readonly delayedTaskService: DelayedTaskService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Handle meeting started event (v4.4 optimized - using meeting_id)
   *
   * Transitions meeting from 'scheduled' to 'active'
   * If meeting was previously ended (with pending completion task), cancels the task
   * This handles the "meeting restart" scenario immediately
   *
   * @param provider - Meeting provider ('feishu' | 'zoom')
   * @param meetingId - Meeting ID from provider (Feishu reserve.id, Zoom id)
   * @param occurredAt - Event occurrence time
   */
  async handleMeetingStarted(
    provider: string,
    meetingId: string,
    occurredAt: Date,
  ): Promise<void> {
    try {
      this.logger.debug(`Handling meeting started: ${provider}/${meetingId}`);

      // Find meeting by provider and meeting_id (direct lookup, no time window needed)
      const meeting = await this.meetingRepo.findByMeetingId(
        provider,
        meetingId,
      );

      if (!meeting) {
        this.logger.warn(
          `Meeting ${provider}/${meetingId} not found for meeting_started event`,
        );
        return;
      }

      // Cancel pending completion task if exists (meeting restart scenario)
      if (meeting.pendingTaskId) {
        this.logger.log(
          `Meeting ${meeting.meetingNo} restarted, cancelling pending completion task ${meeting.pendingTaskId}`,
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
        `Meeting ${meeting.meetingNo} transitioned to ACTIVE (previous: ${previousStatus})`,
      );

      // Emit status changed event
      this.eventEmitter.emit(
        "meeting.status.changed",
        new MeetingStatusChangedEvent(
          meeting.id,
          meeting.meetingNo,
          previousStatus,
          MeetingStatus.ACTIVE,
          occurredAt,
        ),
      );
    } catch (error) {
      this.logger.error(
        `Error handling meeting started for ${provider}/${meetingId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Handle meeting ended event (v4.4 optimized - using meeting_id)
   *
   * Immediately appends time segment to meeting_time_list and recalculates duration
   * Then schedules delayed completion check (30 minutes) for final confirmation
   *
   * Key change: No longer queries event table - time segment is passed directly from webhook
   *
   * @param provider - Meeting provider ('feishu' | 'zoom')
   * @param meetingId - Meeting ID from provider (Feishu reserve.id, Zoom id)
   * @param timeSegment - Time segment extracted from meeting.ended event
   * @param occurredAt - Event occurrence time
   */
  async handleMeetingEnded(
    provider: string,
    meetingId: string,
    timeSegment: TimeSegment,
    occurredAt: Date,
  ): Promise<void> {
    try {
      this.logger.debug(`Handling meeting ended: ${provider}/${meetingId}`);

      // Find meeting by provider and meeting_id (direct lookup, no time window needed)
      const meeting = await this.meetingRepo.findByMeetingId(
        provider,
        meetingId,
      );

      if (!meeting) {
        this.logger.warn(
          `Meeting ${provider}/${meetingId} not found for meeting_ended event`,
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

      // Append new time segment to meeting_time_list
      const existingSegments = (meeting.meetingTimeList as TimeSegment[]) || [];
      const updatedSegments = [...existingSegments, timeSegment];

      // Calculate total duration from all segments
      const totalDuration = this.calculateTotalDuration(updatedSegments);

      // Schedule delayed completion check (30 minutes)
      const taskId = await this.delayedTaskService.scheduleCompletionCheck(
        meeting.id,
        meeting.meetingNo,
        occurredAt,
      );

      // Update meeting with new time segment and recalculated duration
      await this.meetingRepo.update(meeting.id, {
        lastMeetingEndedTimestamp: occurredAt,
        pendingTaskId: taskId,
        actualDuration: totalDuration,
        meetingTimeList: updatedSegments,
      });

      this.logger.log(
        `Meeting ${meeting.meetingNo} updated with duration: ${totalDuration}s (${updatedSegments.length} segment(s)), scheduled completion check (task: ${taskId})`,
      );
    } catch (error) {
      this.logger.error(
        `Error handling meeting ended for ${provider}/${meetingId}: ${error instanceof Error ? error.message : String(error)}`,
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
   * Calculate total duration from time segments (v4.3)
   * 
   * Simple calculation from ISO timestamp strings in meeting_time_list
   * No event table query needed
   *
   * @param timeSegments - Array of time segments
   * @returns Total duration in seconds
   */
  private calculateTotalDuration(timeSegments: TimeSegment[]): number {
    let totalDurationSeconds = 0;

    for (const segment of timeSegments) {
      const startDate = new Date(segment.start);
      const endDate = new Date(segment.end);
      
      const durationSeconds = Math.floor(
        (endDate.getTime() - startDate.getTime()) / 1000,
      );

      if (durationSeconds > 0) {
        totalDurationSeconds += durationSeconds;
      } else {
        this.logger.warn(
          `Invalid time segment: start=${segment.start}, end=${segment.end}`,
        );
      }
    }

    // Convert to minutes (rounded)
    return Math.round(totalDurationSeconds / 60);
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
   * Handle recording ready event (v4.4 optimized - using meeting_id)
   *
   * Updates meeting with recording URL
   *
   * @param provider - Meeting provider ('feishu' | 'zoom')
   * @param meetingId - Meeting ID from provider (Feishu reserve.id, Zoom id)
   * @param recordingUrl - Recording URL
   */
  async handleRecordingReady(
    provider: string,
    meetingId: string,
    recordingUrl: string,
  ): Promise<void> {
    try {
      this.logger.debug(`Handling recording ready: ${provider}/${meetingId}`);

      // Find meeting by provider and meeting_id (direct lookup, no time window needed)
      const meeting = await this.meetingRepo.findByMeetingId(
        provider,
        meetingId,
      );

      if (!meeting) {
        this.logger.warn(
          `Meeting ${provider}/${meetingId} not found for recording_ready event`,
        );
        return;
      }

      // Update recording URL
      await this.meetingRepo.update(meeting.id, {
        recordingUrl,
      });

      this.logger.log(`Recording URL updated for meeting ${meeting.meetingNo}`);

      // Emit recording ready event 
      const recordingPayload: MeetingRecordingReadyPayload = {
        meetingId: meeting.id,
        meetingNo: meeting.meetingNo,
        recordingUrl,
        readyAt: new Date(),
      };

      this.eventEmitter.emit(
        MEETING_RECORDING_READY_EVENT,
        recordingPayload,
      );
    } catch (error) {
      this.logger.error(
        `Error handling recording ready for ${provider}/${meetingId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}

