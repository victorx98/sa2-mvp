import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RegularMentoringService } from '../services/regular-mentoring.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

/**
 * Regular Mentoring Event Listener
 * 
 * Listens to Core Meeting lifecycle events and updates regular mentoring session status
 */
@Injectable()
export class RegularMentoringEventListener {
  private readonly logger = new Logger(RegularMentoringEventListener.name);

  constructor(
    private readonly regularMentoringService: RegularMentoringService,
  ) {}

  /**
   * Handle meeting lifecycle completed event
   */
  @OnEvent(MEETING_LIFECYCLE_COMPLETED_EVENT)
  async handleMeetingCompletion(
    payload: MeetingLifecycleCompletedPayload,
  ): Promise<void> {
    this.logger.log(
      `Received meeting.lifecycle.completed event for meeting ${payload.meetingId}`,
    );

    try {
      // Find session by meetingId
      const session = await this.regularMentoringService.findByMeetingId(
        payload.meetingId,
      );

      if (session) {
        this.logger.log(
          `Found regular mentoring session ${session.id} for meeting ${payload.meetingId}`,
        );

        // Complete session (does not synchronously update Calendar)
        await this.regularMentoringService.completeSession(session.id, payload);

        this.logger.log(
          `Successfully completed regular mentoring session ${session.id}`,
        );
      } else {
        this.logger.debug(
          `No regular mentoring session found for meeting ${payload.meetingId}, skipping`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling meeting completion for meeting ${payload.meetingId}: ${error.message}`,
        error.stack,
      );
    }
  }
}

