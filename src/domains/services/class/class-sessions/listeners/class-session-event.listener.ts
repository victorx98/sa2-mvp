import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClassSessionService } from '../services/class-session.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

/**
 * Class Session Event Listener
 *
 * Listen to Core Meeting lifecycle events and update class session status
 */
@Injectable()
export class ClassSessionEventListener {
  private readonly logger = new Logger(ClassSessionEventListener.name);

  constructor(private readonly classSessionService: ClassSessionService) {}

  /**
   * Handle meeting lifecycle completion event
   *
   * @param payload - Meeting lifecycle completion event payload from Core layer
   */
  @OnEvent(MEETING_LIFECYCLE_COMPLETED_EVENT)
  async handleMeetingCompletion(payload: MeetingLifecycleCompletedPayload): Promise<void> {
    this.logger.log(`Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`);

    try {
      // 1. Find Class Session domain record by meetingId
      const session = await this.classSessionService.findByMeetingId(payload.meetingId);

      if (session) {
        // 2. Found it - this meeting belongs to Class Session
        this.logger.log(`Found class session ${session.id} for meeting ${payload.meetingId}`);

        // 3. Complete the session
        await this.classSessionService.completeSession(session.id, payload);

        this.logger.log(`Successfully completed class session ${session.id}`);
      } else {
        // 4. Not found - this meeting may belong to other domain, skip
        this.logger.debug(`No class session found for meeting ${payload.meetingId}, skipping`);
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

