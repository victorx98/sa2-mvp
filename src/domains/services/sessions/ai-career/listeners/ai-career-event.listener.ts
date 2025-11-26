import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AiCareerService } from '../services/ai-career.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

/**
 * AI Career Event Listener
 * 
 * Listens to Core Meeting lifecycle events and updates AI career session status
 */
@Injectable()
export class AiCareerEventListener {
  private readonly logger = new Logger(AiCareerEventListener.name);

  constructor(
    private readonly aiCareerService: AiCareerService,
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
      const session = await this.aiCareerService.findByMeetingId(
        payload.meetingId,
      );

      if (session) {
        this.logger.log(
          `Found AI career session ${session.id} for meeting ${payload.meetingId}`,
        );

        await this.aiCareerService.completeSession(session.id, payload);

        this.logger.log(
          `Successfully completed AI career session ${session.id}`,
        );
      } else {
        this.logger.debug(
          `No AI career session found for meeting ${payload.meetingId}, skipping`,
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

