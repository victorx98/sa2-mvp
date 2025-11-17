import { Injectable, Logger } from "@nestjs/common";
import {
  IMeetingProvider,
  ICreateMeetingInput,
  IUpdateMeetingInput,
  IMeetingInfo,
  MeetingProviderType,
} from "../interfaces/meeting-provider.interface";
import { FeishuMeetingClient } from "./feishu-meeting.client";
import {
  MeetingCreationFailedException,
  MeetingUpdateFailedException,
  MeetingCancellationFailedException,
  MeetingNotFoundException,
} from "../exceptions/meeting-provider.exception";
import { Trace, addSpanAttributes } from "@shared/decorators/trace.decorator";

/**
 * Feishu Meeting Adapter
 *
 * Implements IMeetingProvider interface for Feishu (Lark) platform
 */
@Injectable()
export class FeishuMeetingAdapter implements IMeetingProvider {
  private readonly logger = new Logger(FeishuMeetingAdapter.name);

  constructor(private readonly feishuClient: FeishuMeetingClient) {}

  /**
   * Create a meeting on Feishu
   *
   * According to Feishu API documentation:
   * - end_time must be a Unix timestamp in seconds (as a number, not string)
   * - The API requires the meeting reservation to be specified with end_time
   *
   * @param input - Meeting creation parameters
   * @returns Meeting information
   */
  @Trace({
    name: 'feishu.meeting.create',
    attributes: { 'meeting.provider': 'feishu' },
  })
  async createMeeting(input: ICreateMeetingInput): Promise<IMeetingInfo> {
    try {
      this.logger.debug(
        `Creating Feishu meeting: ${input.topic} at ${input.startTime}`,
      );

      // Add span attributes for context
      addSpanAttributes({
        'meeting.topic': input.topic,
        'meeting.duration': input.duration,
        'meeting.host_user_id': input.hostUserId || 'unknown',
      });

      if (!input.hostUserId) {
        throw new MeetingCreationFailedException(
          "Feishu",
          "Feishu meeting requires hostUserId (Feishu user ID) to be provided",
        );
      }

      // Calculate timestamps (Feishu expects Unix timestamps in seconds)
      const startTime = new Date(input.startTime);
      const endTime = new Date(
        startTime.getTime() + input.duration * 60 * 1000,
      );

      // Convert to Unix timestamp in seconds as numbers
      const startTimeUnix = Math.floor(startTime.getTime() / 1000);
      const endTimeUnix = Math.floor(endTime.getTime() / 1000);

      this.logger.debug(
        `Meeting times - Start: ${startTimeUnix}, End: ${endTimeUnix} (Unix seconds)`,
      );

      // Build Feishu API payload based on official documentation
      const payload = {
        end_time: endTimeUnix.toString(),
        owner_id: input.hostUserId,
        meeting_settings: {
          topic: input.topic,
          meeting_initial_type: 1, // Reserved meeting type
          auto_record: input.autoRecord ?? false,
          open_lobby: false,
          allow_attendees_start: input.participantJoinEarly ?? true,
        },
      };

      this.logger.debug(
        `Feishu API payload: ${JSON.stringify(payload)}`,
      );

      // Call Feishu API
      const response = await this.feishuClient.applyReservation(payload);

      // Map Feishu response to standard MeetingInfo
      const meetingInfo: IMeetingInfo = {
        provider: MeetingProviderType.FEISHU,
        meetingId: response.reserve.id,
        meetingNo: response.reserve.meeting_no,
        meetingUrl: response.reserve.url,
        meetingPassword: null, // Feishu doesn't use passwords
        hostJoinUrl: null, // Feishu doesn't have separate host URL
        startTime: startTime,
        duration: input.duration,
      };

      // Add result attributes to span
      addSpanAttributes({
        'meeting.id': meetingInfo.meetingId,
        'meeting.no': meetingInfo.meetingNo,
      });

      this.logger.debug(
        `Successfully created Feishu meeting: ${meetingInfo.meetingId}`,
      );
      return meetingInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create Feishu meeting: ${message}`);
      throw new MeetingCreationFailedException("Feishu", message);
    }
  }

  /**
   * Update a meeting on Feishu
   *
   * @param meetingId - Meeting ID (reserve_id)
   * @param input - Meeting update parameters
   * @returns Success status
   */
  @Trace({
    name: 'feishu.meeting.update',
    attributes: { 'meeting.provider': 'feishu' },
  })
  async updateMeeting(
    meetingId: string,
    input: IUpdateMeetingInput,
  ): Promise<boolean> {
    try {
      this.logger.debug(`Updating Feishu meeting: ${meetingId}`);

      // Build update payload
      const payload: {
        end_time?: string;
        meeting_settings?: {
          topic?: string;
          auto_record?: boolean;
          allow_attendees_start?: boolean;
        };
      } = {};

      // Calculate new end time if startTime or duration changed
      if (input.startTime || input.duration) {
        // Need to get current meeting info to calculate end time
        const currentInfo =
          await this.feishuClient.getReservationInfo(meetingId);
        const startTime = input.startTime
          ? new Date(input.startTime)
          : new Date(currentInfo.reserve.meeting_start_time);
        const duration = input.duration ?? currentInfo.reserve.meeting_duration;
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
        payload.end_time = Math.floor(endTime.getTime() / 1000).toString();
      }

      // Set meeting settings
      if (input.topic || input.autoRecord !== undefined) {
        payload.meeting_settings = {};
        if (input.topic) {
          payload.meeting_settings.topic = input.topic;
        }
        if (input.autoRecord !== undefined) {
          payload.meeting_settings.auto_record = input.autoRecord;
        }
      }

      // Call Feishu API
      await this.feishuClient.updateReservation(meetingId, payload);

      this.logger.debug(`Successfully updated Feishu meeting: ${meetingId}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update Feishu meeting: ${message}`);
      throw new MeetingUpdateFailedException("Feishu", meetingId, message);
    }
  }

  /**
   * Cancel a meeting on Feishu
   *
   * @param meetingId - Meeting ID (reserve_id)
   * @returns Success status
   */
  @Trace({
    name: 'feishu.meeting.cancel',
    attributes: { 'meeting.provider': 'feishu' },
  })
  async cancelMeeting(meetingId: string): Promise<boolean> {
    try {
      this.logger.debug(`Canceling Feishu meeting: ${meetingId}`);

      // Call Feishu API
      await this.feishuClient.deleteReservation(meetingId);

      this.logger.debug(`Successfully canceled Feishu meeting: ${meetingId}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cancel Feishu meeting: ${message}`);
      throw new MeetingCancellationFailedException(
        "Feishu",
        meetingId,
        message,
      );
    }
  }

  /**
   * Get meeting information from Feishu
   *
   * @param meetingId - Meeting ID (reserve_id)
   * @returns Meeting information
   */
  @Trace({
    name: 'feishu.meeting.get_info',
    attributes: { 'meeting.provider': 'feishu' },
  })
  async getMeetingInfo(meetingId: string): Promise<IMeetingInfo> {
    try {
      this.logger.debug(`Fetching Feishu meeting info: ${meetingId}`);

      // Call Feishu API
      const response = await this.feishuClient.getReservationInfo(meetingId);

      // Map Feishu response to standard MeetingInfo
      const meetingInfo: IMeetingInfo = {
        provider: MeetingProviderType.FEISHU,
        meetingId: response.reserve.id,
        meetingNo: response.reserve.meeting_no,
        meetingUrl: response.reserve.url,
        meetingPassword: null,
        hostJoinUrl: null,
        startTime: new Date(response.reserve.meeting_start_time),
        duration: response.reserve.meeting_duration,
      };

      this.logger.debug(
        `Successfully fetched Feishu meeting info: ${meetingId}`,
      );
      return meetingInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch Feishu meeting info: ${message}`);
      throw new MeetingNotFoundException("Feishu", meetingId);
    }
  }
}
