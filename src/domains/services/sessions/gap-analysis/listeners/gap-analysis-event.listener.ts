import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { GapAnalysisService } from '../services/gap-analysis.service';
import {
  MeetingLifecycleCompletedPayload,
  MEETING_LIFECYCLE_COMPLETED_EVENT,
} from '@shared/events';

/**
 * Gap Analysis Event Listener
 * 
 * Listens to Core Meeting lifecycle events and updates gap analysis session status
 */
@Injectable()
export class GapAnalysisEventListener {
  private readonly logger = new Logger(GapAnalysisEventListener.name);

  constructor(
    private readonly gapAnalysisService: GapAnalysisService,
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
      const session = await this.gapAnalysisService.findByMeetingId(
        payload.meetingId,
      );

      if (session) {
        this.logger.log(
          `Found gap analysis session ${session.id} for meeting ${payload.meetingId}`,
        );

        await this.gapAnalysisService.completeSession(session.id, payload);

        this.logger.log(
          `Successfully completed gap analysis session ${session.id}`,
        );
      } else {
        this.logger.debug(
          `No gap analysis session found for meeting ${payload.meetingId}, skipping`,
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

