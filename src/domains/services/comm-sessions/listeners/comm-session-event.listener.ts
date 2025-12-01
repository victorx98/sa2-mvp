import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CommSessionService } from '../services/comm-session.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

/**
 * Comm Session Event Listener
 *
 * Listen to Core Meeting lifecycle events and update comm session status
 * Note: Does NOT register service or emit completion event
 */
@Injectable()
export class CommSessionEventListener {
  private readonly logger = new Logger(CommSessionEventListener.name);

  constructor(private readonly commSessionService: CommSessionService) {}

  /**
   * Handle meeting lifecycle completion event
   *
   * Event flow:
   * 1. Core/Meeting publishes meeting.lifecycle.completed event
   * 2. CommSessionEventListener receives event
   * 3. Query comm_sessions by meetingId
   * 4. If found: completeSession()
   *    - Update status = 'completed'
   *    - Set completed_at
   *    ✅ Done (no service registration, no completion event)
   *
   * @param payload - Meeting lifecycle completion event payload from Core layer
   */
  @OnEvent(MEETING_LIFECYCLE_COMPLETED_EVENT)
  async handleMeetingCompletion(
    payload: MeetingLifecycleCompletedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`,
    );

    try {
      // 1. Find Comm Session domain record by meetingId
      const session = await this.commSessionService.findByMeetingId(payload.meetingId);

      if (session) {
        // 2. Found it - this meeting belongs to Comm Session
        this.logger.log(
          `Found comm session ${session.id} for meeting ${payload.meetingId}`,
        );

        // 3. Complete the session
        await this.commSessionService.completeSession(session.id, payload);

        this.logger.log(`Successfully completed comm session ${session.id}`);
      } else {
        // 4. Not found - this meeting may belong to other domain, skip
        this.logger.debug(
          `No comm session found for meeting ${payload.meetingId}, skipping`,
        );
      }
    } catch (error) {
      // Log error but do not throw - avoid breaking other listeners
      this.logger.error(
        `Error handling meeting completion for meeting ${payload.meetingId}: ${error.message}`,
        error.stack,
      );
    }
  }
}

