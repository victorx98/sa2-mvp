import { Injectable, Logger } from "@nestjs/common";
import { MeetingEventEntity } from "../entities/meeting-event.entity";
import { MeetingTimeSegment } from "../entities/meeting.entity";

/**
 * Duration Calculator Service
 *
 * Calculates meeting duration and time segments from join/leave events
 * Implements algorithm based on event sourcing pattern
 */
@Injectable()
export class DurationCalculatorService {
  private readonly logger = new Logger(DurationCalculatorService.name);

  /**
   * Calculate meeting duration and time segments from events
   *
   * Algorithm:
   * 1. Extract all join/leave events
   * 2. Sort by occurrence time
   * 3. Track participant count to determine meeting start/end
   * 4. Generate time segments when count goes 0 -> N or N -> 0
   * 5. Calculate total duration as sum of all segments
   *
   * @param events - Array of meeting events (all types)
   * @returns Object containing duration in seconds and time segment list
   */
  calculateDuration(events: MeetingEventEntity[]): {
    durationSeconds: number;
    timeSegments: MeetingTimeSegment[];
  } {
    // Filter join/leave events
    const joinLeaveEvents = events.filter((event) =>
      this.isJoinOrLeaveEvent(event.eventType),
    );

    if (joinLeaveEvents.length === 0) {
      this.logger.warn("No join/leave events found for duration calculation");
      return {
        durationSeconds: 0,
        timeSegments: [],
      };
    }

    // Sort events by occurrence time
    const sortedEvents = [...joinLeaveEvents].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
    );

    const timeSegments: MeetingTimeSegment[] = [];
    let participantCount = 0;
    let segmentStartTime: Date | null = null;

    for (const event of sortedEvents) {
      const isJoin = this.isJoinEvent(event.eventType);

      if (isJoin) {
        // Participant joined
        if (participantCount === 0) {
          // First participant - meeting segment starts
          segmentStartTime = event.occurredAt;
        }
        participantCount++;
      } else {
        // Participant left
        participantCount = Math.max(0, participantCount - 1);

        if (participantCount === 0 && segmentStartTime) {
          // Last participant left - meeting segment ends
          timeSegments.push({
            start: segmentStartTime,
            end: event.occurredAt,
          });
          segmentStartTime = null;
        }
      }
    }

    // Handle case where meeting is still ongoing (no final leave event)
    if (participantCount > 0 && segmentStartTime) {
      const lastEvent = sortedEvents[sortedEvents.length - 1];
      timeSegments.push({
        start: segmentStartTime,
        end: lastEvent.occurredAt,
      });
      this.logger.warn(
        "Meeting segment not properly closed (participants still in meeting)",
      );
    }

    // Calculate total duration
    const durationSeconds = timeSegments.reduce((total, segment) => {
      const segmentDuration =
        (segment.end.getTime() - segment.start.getTime()) / 1000;
      return total + segmentDuration;
    }, 0);

    this.logger.debug(
      `Calculated duration: ${durationSeconds}s from ${timeSegments.length} segment(s)`,
    );

    return {
      durationSeconds: Math.floor(durationSeconds),
      timeSegments,
    };
  }

  /**
   * Check if event type is join or leave event
   *
   * @param eventType - Event type string
   * @returns True if join or leave event
   */
  private isJoinOrLeaveEvent(eventType: string): boolean {
    const joinLeaveTypes = [
      "vc.meeting.join_meeting_v1", // Feishu join
      "vc.meeting.leave_meeting_v1", // Feishu leave
      "meeting.participant_joined", // Zoom join
      "meeting.participant_left", // Zoom leave
    ];

    return joinLeaveTypes.includes(eventType);
  }

  /**
   * Check if event type is join event
   *
   * @param eventType - Event type string
   * @returns True if join event
   */
  private isJoinEvent(eventType: string): boolean {
    const joinTypes = [
      "vc.meeting.join_meeting_v1", // Feishu
      "meeting.participant_joined", // Zoom
    ];

    return joinTypes.includes(eventType);
  }

  /**
   * Validate if duration calculation is reasonable
   *
   * @param durationSeconds - Calculated duration
   * @param scheduledDurationMinutes - Scheduled duration
   * @returns True if duration seems valid
   */
  validateDuration(
    durationSeconds: number,
    scheduledDurationMinutes: number,
  ): boolean {
    // Check if actual duration is within reasonable range (0 to 3x scheduled)
    const maxReasonableDuration = scheduledDurationMinutes * 60 * 3;

    if (durationSeconds < 0 || durationSeconds > maxReasonableDuration) {
      this.logger.warn(
        `Suspicious duration detected: ${durationSeconds}s (scheduled: ${scheduledDurationMinutes}min)`,
      );
      return false;
    }

    return true;
  }
}

