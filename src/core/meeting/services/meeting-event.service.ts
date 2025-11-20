import { Injectable, Logger } from "@nestjs/common";
import { MeetingEventRepository } from "../repositories/meeting-event.repository";
import { CreateMeetingEventInput } from "../entities/meeting-event.entity";
import { MeetingLifecycleService } from "./meeting-lifecycle.service";
import type { MeetingEvent } from "@infrastructure/database/schema/meeting-events.schema";
import type { DrizzleTransaction } from "@shared/types/database.types";

/**
 * Meeting Event Service
 *
 * Core entry point for webhook event processing
 * Responsibilities:
 * 1. Write event logs to database (event sourcing)
 * 2. Deduplicate events based on event_id
 * 3. Route events to appropriate lifecycle handlers
 */
@Injectable()
export class MeetingEventService {
  private readonly logger = new Logger(MeetingEventService.name);

  constructor(
    private readonly repository: MeetingEventRepository,
    private readonly lifecycleService: MeetingLifecycleService,
  ) {}

  /**
   * Record a meeting event with automatic deduplication and routing
   *
   * Flow:
   * 1. Check if event already exists (deduplication via event_id)
   * 2. If new, write to meeting_events table
   * 3. Route event to lifecycle service based on event_type
   *
   * @param eventData - Extracted event data from webhook
   * @param tx - Optional transaction
   * @returns Created or existing event
   */
  async recordEvent(
    eventData: CreateMeetingEventInput,
    tx?: DrizzleTransaction,
  ): Promise<MeetingEvent> {
    // Step 1: Deduplication check
    const existingEvent = await this.repository.findByEventId(
      eventData.eventId,
    );

    if (existingEvent) {
      this.logger.debug(
        `Event ${eventData.eventId} already exists, skipping (idempotency)`,
      );
      return existingEvent;
    }

    // Step 2: Write event log
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
        operatorId: eventData.operatorId ?? null,
        operatorRole: eventData.operatorRole ?? null,
        meetingTopic: eventData.meetingTopic ?? null,
        meetingStartTime: eventData.meetingStartTime ?? null,
        meetingEndTime: eventData.meetingEndTime ?? null,
        eventData: eventData.eventData,
        occurredAt: eventData.occurredAt,
      },
      tx,
    );

    this.logger.log(
      `Event recorded: ${eventData.eventType} for meeting ${eventData.meetingNo || eventData.meetingId}`,
    );

    // Step 3: Route to lifecycle service (async, non-blocking)
    // Use setImmediate to avoid blocking webhook response
    setImmediate(() => {
      this.routeEventToLifecycle(event).catch((error) => {
        this.logger.error(
          `Failed to route event to lifecycle service: ${error.message}`,
          error.stack,
        );
      });
    });

    return event;
  }

  /**
   * Route event to appropriate lifecycle handler
   *
   * @param event - Meeting event entity
   */
  private async routeEventToLifecycle(event: MeetingEvent): Promise<void> {
    const { eventType, meetingNo, occurredAt } = event;

    try {
      switch (eventType) {
        case "vc.meeting.meeting_started_v1": // Feishu
        case "meeting.started": // Zoom
          await this.lifecycleService.handleMeetingStarted(
            meetingNo,
            occurredAt,
          );
          break;

        case "vc.meeting.meeting_ended_v1": // Feishu
        case "meeting.ended": // Zoom
          await this.lifecycleService.handleMeetingEnded(meetingNo, occurredAt);
          break;

        case "vc.meeting.recording_ready_v1": // Feishu
        case "meeting.recording_completed": // Zoom
          // Extract recording URL from event data
          const recordingUrl = this.extractRecordingUrl(event);
          if (recordingUrl) {
            await this.lifecycleService.handleRecordingReady(
              meetingNo,
              recordingUrl,
            );
          }
          break;

        // Join/Leave events are handled by duration calculator
        case "vc.meeting.join_meeting_v1":
        case "vc.meeting.leave_meeting_v1":
        case "meeting.participant_joined":
        case "meeting.participant_left":
          this.logger.debug(
            `Join/Leave event recorded, will be used for duration calculation`,
          );
          break;

        default:
          this.logger.debug(`Event type ${eventType} does not require routing`);
      }
    } catch (error) {
      this.logger.error(
        `Error routing event ${eventType}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  /**
   * Extract recording URL from event data
   *
   * @param event - Meeting event
   * @returns Recording URL if available
   */
  private extractRecordingUrl(event: MeetingEvent): string | null {
    const eventData = event.eventData as {
      recording?: { url?: string };
      recording_files?: Array<{ download_url?: string }>;
    };

    // Feishu format
    if (eventData.recording?.url) {
      return eventData.recording.url;
    }

    // Zoom format
    if (
      eventData.recording_files &&
      eventData.recording_files.length > 0 &&
      eventData.recording_files[0].download_url
    ) {
      return eventData.recording_files[0].download_url;
    }

    return null;
  }

  /**
   * Find event by event_id for external deduplication check
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
   * @param meetingNo - Meeting number
   * @returns Array of events matching the meeting number
   */
  async findByMeetingNo(meetingNo: string): Promise<MeetingEvent[]> {
    return this.repository.findByMeetingNo(meetingNo);
  }
}

