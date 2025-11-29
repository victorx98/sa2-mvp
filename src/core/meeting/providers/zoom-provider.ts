import { Injectable, Logger } from "@nestjs/common";
import {
  IMeetingProvider,
  ICreateMeetingInput,
  IUpdateMeetingInput,
  IMeetingInfo,
  MeetingProviderType,
} from "./provider.interface";
import { ZoomMeetingClient } from "./zoom-provider.client";
import {
  MeetingCreationFailedException,
  MeetingUpdateFailedException,
  MeetingCancellationFailedException,
  MeetingNotFoundException,
} from "../exceptions/meeting.exception";
import { Trace, addSpanAttributes } from "@shared/decorators/trace.decorator";

/**
 * Zoom Meeting Provider
 *
 * Implements IMeetingProvider interface for Zoom platform
 * Uses Server-to-Server OAuth for authentication
 * https://developers.zoom.us/docs/api/meetings/
 */
@Injectable()
export class ZoomMeetingProvider implements IMeetingProvider {
  private readonly logger = new Logger(ZoomMeetingProvider.name);

  constructor(private readonly zoomClient: ZoomMeetingClient) {}

  /**
   * Create a meeting on Zoom
   *
   * According to Zoom API documentation:
   * - Meeting type 2 is for scheduled meetings
   * - start_time must be in ISO 8601 format
   * - Zoom uses meeting ID (number) as the identifier for update/cancel
   *
   * @param input - Meeting creation parameters
   * @returns Meeting information
   */
  @Trace({
    name: 'zoom.meeting.create',
    attributes: { 'meeting.provider': 'zoom' },
  })
  async createMeeting(input: ICreateMeetingInput): Promise<IMeetingInfo> {
    try {
      this.logger.debug(
        `Creating Zoom meeting: ${input.topic} at ${input.startTime}`,
      );

      // Add span attributes for context
      addSpanAttributes({
        'meeting.topic': input.topic,
        'meeting.duration': input.duration,
        'meeting.host_user_id': input.hostUserId || 'me',
      });

      // Zoom requires userId (can be user ID, email, or "me" for authenticated user)
      // If hostUserId is not provided, use "me" (requires proper OAuth scopes)
      const userId = input.hostUserId || "me";

      // Format start time to ISO 8601 (Zoom requirement)
      const startTime = new Date(input.startTime);
      const startTimeISO = startTime.toISOString();

      this.logger.debug(
        `Meeting times - Start: ${startTimeISO}, Duration: ${input.duration} minutes`,
      );

      // Build Zoom API payload based on official documentation
      // https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingCreate
      const payload = {
        topic: input.topic,
        type: 2, // Scheduled meeting
        start_time: startTimeISO,
        duration: input.duration,
        timezone: "UTC", // Using UTC for consistency
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: input.participantJoinEarly ?? true,
          mute_upon_entry: false,
          watermark: false,
          use_pmi: false,
          approval_type: 2, // No registration required
          audio: "both" as const, // Both telephony and VoIP
          auto_recording: input.autoRecord ? "cloud" : "none",
          waiting_room: input.enableWaitingRoom ?? false,
          meeting_authentication: false, // No authentication required to join
        },
      };

      this.logger.debug(`Zoom API payload: ${JSON.stringify(payload)}`);

      // Call Zoom API
      const response = await this.zoomClient.createMeeting(userId, payload);

      // Map Zoom response to standard MeetingInfo
      // Note: Zoom doesn't have meeting_no like Feishu, so we use null
      // Zoom's id field maps to our unified meetingId field
      const meetingInfo: IMeetingInfo = {
        provider: MeetingProviderType.ZOOM,
        meetingNo: null, // Zoom doesn't use meeting number like Feishu
        meetingId: response.id.toString(), // Zoom meeting id (used for update/cancel and event mapping)
        meetingUrl: response.join_url, // Participant join URL
        meetingPassword: response.password || null,
        hostJoinUrl: response.start_url, // Host-specific join URL
        startTime: startTime,
        duration: input.duration,
      };

      // Add result attributes to span
      addSpanAttributes({
        'meeting.meeting_id': meetingInfo.meetingId,
        'meeting.uuid': response.uuid,
      });

      this.logger.debug(
        `Successfully created Zoom meeting: ${meetingInfo.meetingId} (UUID: ${response.uuid})`,
      );
      return meetingInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create Zoom meeting: ${message}`);
      throw new MeetingCreationFailedException("Zoom", message);
    }
  }

  /**
   * Update a meeting on Zoom
   *
   * @param meetingId - Meeting ID (Zoom id)
   * @param input - Meeting update parameters
   * @returns Success status
   */
  @Trace({
    name: 'zoom.meeting.update',
    attributes: { 'meeting.provider': 'zoom' },
  })
  async updateMeeting(
    meetingId: string,
    input: IUpdateMeetingInput,
  ): Promise<boolean> {
    try {
      this.logger.debug(`Updating Zoom meeting: ${meetingId}`);

      // Build update payload
      const payload: {
        topic?: string;
        start_time?: string;
        duration?: number;
        timezone?: string;
        settings?: {
          auto_recording?: string;
        };
      } = {};

      if (input.topic) {
        payload.topic = input.topic;
      }

      if (input.startTime) {
        payload.start_time = new Date(input.startTime).toISOString();
        payload.timezone = "UTC";
      }

      if (input.duration) {
        payload.duration = input.duration;
      }

      if (input.autoRecord !== undefined) {
        payload.settings = {
          auto_recording: input.autoRecord ? "cloud" : "none",
        };
      }

      // Call Zoom API
      await this.zoomClient.updateMeeting(meetingId, payload);

      this.logger.debug(`Successfully updated Zoom meeting: ${meetingId}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update Zoom meeting: ${message}`);
      throw new MeetingUpdateFailedException("Zoom", meetingId, message);
    }
  }

  /**
   * Cancel a meeting on Zoom
   *
   * @param meetingId - Meeting ID (Zoom id)
   * @returns Success status
   */
  @Trace({
    name: 'zoom.meeting.cancel',
    attributes: { 'meeting.provider': 'zoom' },
  })
  async cancelMeeting(meetingId: string): Promise<boolean> {
    try {
      this.logger.debug(`Canceling Zoom meeting: ${meetingId}`);

      // Call Zoom API
      await this.zoomClient.deleteMeeting(meetingId);

      this.logger.debug(`Successfully canceled Zoom meeting: ${meetingId}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cancel Zoom meeting: ${message}`);
      throw new MeetingCancellationFailedException("Zoom", meetingId, message);
    }
  }

  /**
   * Get meeting information from Zoom
   *
   * @param meetingId - Meeting ID (Zoom id)
   * @returns Meeting information
   */
  @Trace({
    name: 'zoom.meeting.get_info',
    attributes: { 'meeting.provider': 'zoom' },
  })
  async getMeetingInfo(meetingId: string): Promise<IMeetingInfo> {
    try {
      this.logger.debug(`Fetching Zoom meeting info: ${meetingId}`);

      // Call Zoom API
      const response = await this.zoomClient.getMeeting(meetingId);

      // Map Zoom response to standard MeetingInfo
      const meetingInfo: IMeetingInfo = {
        provider: MeetingProviderType.ZOOM,
        meetingNo: null,
        meetingId: response.id.toString(),
        meetingUrl: response.join_url,
        meetingPassword: response.password || null,
        hostJoinUrl: response.start_url,
        startTime: new Date(response.start_time),
        duration: response.duration,
      };

      this.logger.debug(
        `Successfully fetched Zoom meeting info: ${meetingId}`,
      );
      return meetingInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to fetch Zoom meeting info: ${message}`);
      throw new MeetingNotFoundException("Zoom", meetingId);
    }
  }
}

