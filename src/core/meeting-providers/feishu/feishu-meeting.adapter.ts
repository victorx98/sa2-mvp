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
   * @param input - Meeting creation parameters
   * @returns Meeting information
   */
  async createMeeting(input: ICreateMeetingInput): Promise<IMeetingInfo> {
    // try {
    //   this.logger.debug(
    //     `Creating Feishu meeting: ${input.topic} at ${input.startTime}`,
    //   );

    //   // Calculate end time (Feishu expects Unix timestamp in seconds)
    //   const startTime = new Date(input.startTime);
    //   const endTime = new Date(
    //     startTime.getTime() + input.duration * 60 * 1000,
    //   );
    //   const endTimeUnix = Math.floor(endTime.getTime() / 1000).toString();

    //   // Build Feishu API payload
    //   const payload = {
    //     end_time: endTimeUnix,
    //     meeting_settings: {
    //       topic: input.topic,
    //       auto_record: input.autoRecord ?? false,
    //       open_lobby: false, // Feishu doesn't support waiting room
    //       allow_attendees_start: input.participantJoinEarly ?? true,
    //     },
    //   };

    //   // Call Feishu API
    //   const response = await this.feishuClient.applyReservation(payload);

    //   // Map Feishu response to standard MeetingInfo
    //   const meetingInfo: IMeetingInfo = {
    //     provider: MeetingProviderType.FEISHU,
    //     meetingId: response.reserve.id,
    //     meetingNo: response.reserve.meeting_no,
    //     meetingUrl: response.reserve.url,
    //     meetingPassword: null, // Feishu doesn't use passwords
    //     hostJoinUrl: null, // Feishu doesn't have separate host URL
    //     startTime: startTime,
    //     duration: input.duration,
    //   };

    //   this.logger.debug(
    //     `Successfully created Feishu meeting: ${meetingInfo.meetingId}`,
    //   );
    //   return meetingInfo;
    // } catch (error) {
    //   const message = error instanceof Error ? error.message : String(error);
    //   this.logger.error(`Failed to create Feishu meeting: ${message}`);
    //   throw new MeetingCreationFailedException("Feishu", message);
    // }
    return {
      "provider": MeetingProviderType.FEISHU,
      "meetingId": "123456789",
      "meetingNo": "123456789",
      "meetingUrl": "https://vc.feishu.cn/j/123456789",
      "meetingPassword": null,
      "hostJoinUrl": null,
      "startTime": new Date("2025-11-10T14:00:00Z"),
      "duration": 60,
    }
  }

  /**
   * Create a meeting on Feishu
   *
   * @param input - Meeting creation parameters
   * @returns Meeting information
   */
  async createMeetingTest(input: ICreateMeetingInput): Promise<IMeetingInfo> {
    try {
      this.logger.debug(
        `Creating Feishu meeting: ${input.topic} at ${input.startTime}`,
      );

      // Calculate end time (Feishu expects Unix timestamp in seconds)
      const startTime = new Date(input.startTime);
      const endTime = new Date(
        startTime.getTime() + input.duration * 60 * 1000,
      );
      const endTimeUnix = Math.floor(endTime.getTime() / 1000).toString();

      // Build Feishu API payload
      const payload = {
        end_time: endTimeUnix,
        meeting_settings: {
          topic: input.topic,
          auto_record: input.autoRecord ?? false,
          open_lobby: false, // Feishu doesn't support waiting room
          allow_attendees_start: input.participantJoinEarly ?? true,
        },
      };

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
