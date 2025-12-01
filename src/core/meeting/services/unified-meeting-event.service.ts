import { Injectable, Logger } from "@nestjs/common";
import { FeishuMeetingEventRepository } from "../repositories/feishu-meeting-event.repository";
import { ZoomMeetingEventRepository } from "../repositories/zoom-meeting-event.repository";
import { MeetingLifecycleService } from "./meeting-lifecycle.service";
import { FeishuEventAdapter } from "../adapters/feishu-event.adapter";
import { ZoomEventAdapter } from "../adapters/zoom-event.adapter";
import type { IEventAdapter } from "../adapters/event-adapter.interface";

/**
 * Unified Meeting Event Service (v4.3)
 * 
 * Handles events from both Feishu and Zoom providers using adapter pattern
 * Key design principles:
 * 1. Events are stored in provider-specific tables (feishu_meeting_events / zoom_meeting_events)
 * 2. Adapters extract standardized data from raw events
 * 3. Business logic (MeetingLifecycleService) receives standardized data
 * 4. No queries to event tables during normal operation
 * 
 * Flow:
 * Raw Event → Adapter → Standardized Data → Store in event table + Update meetings table → Lifecycle logic
 */
@Injectable()
export class UnifiedMeetingEventService {
  private readonly logger = new Logger(UnifiedMeetingEventService.name);
  
  private readonly adapters: Record<string, IEventAdapter>;

  constructor(
    private readonly feishuEventRepo: FeishuMeetingEventRepository,
    private readonly zoomEventRepo: ZoomMeetingEventRepository,
    private readonly feishuAdapter: FeishuEventAdapter,
    private readonly zoomAdapter: ZoomEventAdapter,
    private readonly lifecycleService: MeetingLifecycleService,
  ) {
    // Register adapters
    this.adapters = {
      feishu: this.feishuAdapter,
      zoom: this.zoomAdapter,
    };
  }

  /**
   * Record Feishu event
   * 
   * @param rawEvent - Raw Feishu webhook event
   */
  async recordFeishuEvent(rawEvent: any): Promise<void> {
    const adapter = this.adapters.feishu;
    const standardEvent = adapter.extractStandardEvent(rawEvent);

    // Check for duplicate
    const exists = await this.feishuEventRepo.findByEventId(standardEvent.eventId);
    if (exists) {
      this.logger.debug(`Duplicate Feishu event ${standardEvent.eventId}, skipping`);
      return;
    }

    // Store event in feishu_meeting_events table
    await this.feishuEventRepo.create({
      meetingId: standardEvent.meetingId,
      meetingNo: standardEvent.meetingNo,
      eventId: standardEvent.eventId,
      eventType: standardEvent.eventType,
      meetingTopic: standardEvent.meetingTopic || null,
      eventData: standardEvent.rawEventData,
      occurredAt: standardEvent.occurredAt,
    });

    this.logger.debug(`Stored Feishu event: ${standardEvent.eventType} for meeting ${standardEvent.meetingNo}`);

    // Route to lifecycle service
    await this.routeToLifecycle(standardEvent, adapter);
  }

  /**
   * Record Zoom event
   * 
   * @param rawEvent - Raw Zoom webhook event
   */
  async recordZoomEvent(rawEvent: any): Promise<void> {
    const adapter = this.adapters.zoom;
    const standardEvent = adapter.extractStandardEvent(rawEvent);

    // Check for duplicate
    const exists = await this.zoomEventRepo.findByEventId(standardEvent.eventId);
    if (exists) {
      this.logger.debug(`Duplicate Zoom event ${standardEvent.eventId}, skipping`);
      return;
    }

    // Store event in zoom_meeting_events table
    // meetingId: payload.object.id, eventId: payload.object.uuid
    await this.zoomEventRepo.create({
      meetingId: standardEvent.meetingId,    // payload.object.id
      eventId: standardEvent.eventId,        // payload.object.uuid
      eventType: standardEvent.eventType,
      meetingTopic: standardEvent.meetingTopic || null,
      eventData: standardEvent.rawEventData,
      occurredAt: standardEvent.occurredAt,
    });

    this.logger.debug(`Stored Zoom event: ${standardEvent.eventType} for meeting ${standardEvent.meetingId}`);

    // Route to lifecycle service
    await this.routeToLifecycle(standardEvent, adapter);
  }

  /**
   * Route event to appropriate lifecycle handler (v4.4 - using meeting_id)
   * 
   * @param event - Standardized event data
   * @param adapter - Provider adapter
   */
  private async routeToLifecycle(
    event: ReturnType<IEventAdapter['extractStandardEvent']>,
    adapter: IEventAdapter,
  ): Promise<void> {
    try {
      if (adapter.isMeetingStarted(event.eventType)) {
        await this.lifecycleService.handleMeetingStarted(
          event.provider,
          event.meetingId,
          event.occurredAt,
        );
      } else if (adapter.isMeetingEnded(event.eventType)) {
        if (!event.timeSegment) {
          this.logger.warn(
            `No time segment extracted from meeting.ended event for ${event.provider}/${event.meetingId}`,
          );
          return;
        }
        
        await this.lifecycleService.handleMeetingEnded(
          event.provider,
          event.meetingId,
          event.timeSegment,
          event.occurredAt,
        );
      } else if (adapter.isRecordingCompleted(event.eventType)) {
        if (!event.recordingUrl) {
          this.logger.warn(
            `No recording URL extracted from recording.completed event for ${event.provider}/${event.meetingId}`,
          );
          return;
        }
        
        await this.lifecycleService.handleRecordingReady(
          event.provider,
          event.meetingId,
          event.recordingUrl,
        );
      } else {
        this.logger.debug(
          `Event type ${event.eventType} does not require lifecycle routing`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error routing event ${event.eventType}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}

