import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { MentoringService } from "../services/mentoring.service";
import { MeetingLifecycleCompletedEvent } from "@core/meeting/events/meeting-lifecycle.events";

/**
 * Mentoring Event Listener
 *
 * Listens to Core Meeting lifecycle events and updates mentoring session state
 *
 * Design principles:
 * 1. Listen to generic "meeting.lifecycle.completed" event (not mentoring-specific)
 * 2. Use meetingId (UUID) to lookup mentoring session (1:1 FK relationship)
 * 3. If found, update mentoring session; if not found, ignore (belongs to other domain)
 * 4. This approach avoids type filtering and enables clean domain separation
 */
@Injectable()
export class MentoringEventListener {
  private readonly logger = new Logger(MentoringEventListener.name);

  constructor(private readonly mentoringService: MentoringService) {}

  /**
   * Handle meeting lifecycle completion event
   *
   * @param event - Meeting lifecycle completed event from Core Layer
   */
  @OnEvent("meeting.lifecycle.completed")
  async handleMeetingCompletion(
    event: MeetingLifecycleCompletedEvent,
  ): Promise<void> {
    this.logger.log(
      `Received meeting.lifecycle.completed event for meeting ${event.meetingId}`,
    );

    try {
      // 1. Try to find mentoring session by meetingId (UUID FK)
      // This is the most precise lookup method - no ambiguity with meeting_no reuse
      const session = await this.mentoringService.findByMeetingId(
        event.meetingId,
      );

      // 2. If found, this meeting belongs to Mentoring domain
      if (session) {
        this.logger.log(
          `Found mentoring session ${session.id} for meeting ${event.meetingId}`,
        );

        // 3. Complete the mentoring session
        await this.mentoringService.completeSession(session.id, event);

        this.logger.log(
          `Successfully completed mentoring session ${session.id}`,
        );
      } else {
        // 4. Not found? This meeting belongs to another domain (Interview, GapAnalysis, etc.)
        // This is normal and expected - just ignore silently
        this.logger.debug(
          `No mentoring session found for meeting ${event.meetingId}, skipping`,
        );
      }
    } catch (error) {
      // Log error but don't throw - avoid breaking other listeners
      this.logger.error(
        `Error handling meeting completion for meeting ${event.meetingId}: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Handle meeting recording ready event (optional)
   *
   * @param event - Meeting recording ready event from Core Layer
   */
  @OnEvent("meeting.recording.ready")
  async handleRecordingReady(event: {
    meetingId: string;
    meetingNo: string;
    recordingUrl: string;
    readyAt: Date;
  }): Promise<void> {
    this.logger.log(
      `Received meeting.recording.ready event for meeting ${event.meetingId}`,
    );

    try {
      // 1. Find mentoring session
      const session = await this.mentoringService.findByMeetingId(
        event.meetingId,
      );

      if (session) {
        this.logger.log(
          `Recording ready for mentoring session ${session.id}: ${event.recordingUrl}`,
        );

        // TODO: Update mentoring session with recording URL
        // TODO: Trigger notification to mentor/student about recording availability
        // TODO: Trigger AI summary generation
      }
    } catch (error) {
      this.logger.error(
        `Error handling recording ready for meeting ${event.meetingId}: ${error.message}`,
        error.stack,
      );
    }
  }
}

