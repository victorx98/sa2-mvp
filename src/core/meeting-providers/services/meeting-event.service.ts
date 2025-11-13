import { Injectable, Logger } from "@nestjs/common";
import { MeetingEventRepository } from "../repositories/meeting-event.repository";
import { IMeetingEventService } from "@core/webhook/services/meeting-event.service.interface";
import type { ExtractedMeetingEventData } from "@core/webhook/extractors/feishu-event-extractor";
import type { MeetingEvent } from "@infrastructure/database/schema/meeting-events.schema";
import type { DrizzleTransaction } from "@shared/types/database.types";

/**
 * Meeting Event Service
 *
 * Provides meeting event storage with built-in deduplication
 * Called by Webhook Module to store events from Feishu/Zoom
 */
@Injectable()
export class MeetingEventService implements IMeetingEventService {
  private readonly logger = new Logger(MeetingEventService.name);

  constructor(private readonly repository: MeetingEventRepository) {}

  /**
   * Record a meeting event with automatic deduplication
   *
   * @param eventData - Extracted event data
   * @param tx - Optional transaction
   * @returns Created event or existing event if duplicate
   */
  async recordEvent(
    eventData: ExtractedMeetingEventData,
    tx?: DrizzleTransaction,
  ): Promise<MeetingEvent> {
    // 1. Check if event already exists (deduplication)
    const existingEvent = await this.repository.findByEventId(
      eventData.eventId,
    );

    if (existingEvent) {
      this.logger.debug(
        `Event ${eventData.eventId} already exists, skipping (idempotency)`,
      );
      return existingEvent;
    }

    // 2. Create new event record
    this.logger.debug(
      `Recording new event: ${eventData.eventType} (${eventData.eventId})`,
    );

    const event = await this.repository.create(
      {
        meetingId: eventData.meetingId,
        meetingNo: eventData.meetingNo,
        eventId: eventData.eventId,
        eventType: eventData.eventType,
        provider: eventData.provider,
        operatorId: eventData.operatorId,
        operatorRole: eventData.operatorRole,
        meetingTopic: eventData.meetingTopic,
        meetingStartTime: eventData.meetingStartTime,
        meetingEndTime: eventData.meetingEndTime,
        eventData: eventData.eventData,
        occurredAt: eventData.occurredAt,
      },
      tx,
    );

    this.logger.log(
      `Event recorded: ${eventData.eventType} for meeting ${eventData.meetingNo || eventData.meetingId}`,
    );

    return event;
  }

  /**
   * Find event by event_id for deduplication check
   *
   * @param eventId - Event ID to search for
   * @returns Event data if found, null otherwise
   */
  async findByEventId(eventId: string): Promise<MeetingEvent | null> {
    return this.repository.findByEventId(eventId);
  }

  /**
   * Find events by meeting number
   *
   * @param meetingNo - Feishu meeting number
   * @returns Array of events matching the meeting number
   */
  async findByMeetingNo(meetingNo: string): Promise<MeetingEvent[]> {
    return this.repository.findByMeetingNo(meetingNo);
  }

  /**
   * Find events by meeting ID
   *
   * @param meetingId - Meeting ID (platform-specific)
   * @returns Array of events matching the meeting ID
   */
  async findByMeetingId(meetingId: string): Promise<MeetingEvent[]> {
    return this.repository.findByMeetingId(meetingId);
  }

  /**
   * Find join/leave events for duration calculation
   *
   * @param meetingNo - Feishu meeting number
   * @returns Array of join/leave events
   */
  async findJoinLeaveEvents(meetingNo: string): Promise<MeetingEvent[]> {
    const joinLeaveTypes = [
      "vc.meeting.join_meeting_v1",
      "vc.meeting.leave_meeting_v1",
      "meeting.participant_joined",
      "meeting.participant_left",
    ];

    return this.repository.findJoinLeaveEvents(meetingNo, joinLeaveTypes);
  }
}

