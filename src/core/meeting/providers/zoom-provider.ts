import { Injectable, Logger } from "@nestjs/common";
import {
  IMeetingProvider,
  ICreateMeetingInput,
  IUpdateMeetingInput,
  IMeetingInfo,
} from "./provider.interface";
import {
  MeetingCreationFailedException,
  MeetingUpdateFailedException,
  MeetingCancellationFailedException,
  MeetingNotFoundException,
} from "../exceptions/meeting.exception";
import { Trace } from "@shared/decorators/trace.decorator";
/**
 * Zoom Meeting Provider
 *
 * Implements IMeetingProvider interface for Zoom platform
 * TODO: Complete implementation when Zoom integration is needed
 */
@Injectable()
export class ZoomMeetingProvider implements IMeetingProvider {
  private readonly logger = new Logger(ZoomMeetingProvider.name);

  @Trace({
    name: 'zoom.meeting.create',
    attributes: { 'meeting.provider': 'zoom' },
  })
  async createMeeting(_input: ICreateMeetingInput): Promise<IMeetingInfo> {
    this.logger.warn("Zoom meeting creation not yet implemented");
    throw new MeetingCreationFailedException(
      "Zoom",
      "Zoom integration not yet implemented",
    );
  }

  @Trace({
    name: 'zoom.meeting.update',
    attributes: { 'meeting.provider': 'zoom' },
  })
  async updateMeeting(
    meetingId: string,
    _input: IUpdateMeetingInput,
  ): Promise<boolean> {
    this.logger.warn("Zoom meeting update not yet implemented");
    throw new MeetingUpdateFailedException(
      "Zoom",
      meetingId,
      "Zoom integration not yet implemented",
    );
  }

  @Trace({
    name: 'zoom.meeting.cancel',
    attributes: { 'meeting.provider': 'zoom' },
  })
  async cancelMeeting(meetingId: string): Promise<boolean> {
    this.logger.warn("Zoom meeting cancellation not yet implemented");
    throw new MeetingCancellationFailedException(
      "Zoom",
      meetingId,
      "Zoom integration not yet implemented",
    );
  }

  @Trace({
    name: 'zoom.meeting.get_info',
    attributes: { 'meeting.provider': 'zoom' },
  })
  async getMeetingInfo(meetingId: string): Promise<IMeetingInfo> {
    this.logger.warn("Zoom meeting info retrieval not yet implemented");
    throw new MeetingNotFoundException("Zoom", meetingId);
  }
}

