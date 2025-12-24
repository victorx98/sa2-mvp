import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { HandlesEvent, MeetingLifecycleCompletedEvent } from "@application/events";
import { CalendarService, SlotStatus } from "@core/calendar";

/**
 * Meeting Completed Event Listener (v4.1)
 *
 * Listens to meeting lifecycle completed events and updates calendar slots
 * 
 * Design principles:
 * 1. Direct event-driven updates - no dependency on Sessions domain
 * 2. Updates all calendar slots associated with the meeting (mentor + student)
 * 3. Runs in parallel with Sessions domain updates for better performance
 * 4. Graceful error handling - logs errors but doesn't throw to avoid breaking other listeners
 */
@Injectable()
export class MeetingCompletedListener {
  private readonly logger = new Logger(MeetingCompletedListener.name);

  constructor(private readonly calendarService: CalendarService) {}

  /**
   * Handle meeting lifecycle completed event
   * Updates calendar slot status from 'booked' to 'completed'
   *
   * @param payload - Meeting lifecycle completed event payload
   */
  @OnEvent(MeetingLifecycleCompletedEvent.eventType)
  @HandlesEvent(MeetingLifecycleCompletedEvent.eventType, MeetingCompletedListener.name)
  async handleMeetingCompleted(
    event: MeetingLifecycleCompletedEvent,
  ): Promise<void> {
    const payload = event.payload;
    this.logger.log(
      `Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`,
    );

    try {
      // Update all calendar slots associated with this meeting
      const updatedCount = await this.calendarService.updateStatusByMeetingId(
        payload.meetingId,
        SlotStatus.COMPLETED,
      );

      this.logger.log(
        `Updated ${updatedCount} calendar slot(s) to 'completed' for meeting ${payload.meetingId}`,
      );
    } catch (error) {
      // Log error but don't throw - avoid breaking other listeners
      this.logger.error(
        `Error updating calendar slots for meeting ${payload.meetingId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
