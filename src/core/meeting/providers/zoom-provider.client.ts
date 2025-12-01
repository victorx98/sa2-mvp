import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import {
  MeetingProviderAuthenticationException,
  MeetingProviderAPIException,
} from "../exceptions/meeting.exception";

/**
 * Zoom API Response structure
 */
interface IZoomApiResponse<T = unknown> {
  code?: number;
  message?: string;
  data?: T;
}

/**
 * Zoom OAuth Token Response
 * https://developers.zoom.us/docs/internal-apps/s2s-oauth/
 */
interface IZoomOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Zoom Meeting Creation Response
 * https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingCreate
 */
export interface IZoomMeetingCreateResponse {
  id: number; // Meeting ID (used for update/cancel/get)
  uuid: string; // Unique meeting UUID
  host_id: string; // Host user ID
  host_email?: string; // Host email
  topic: string; // Meeting topic
  type: number; // Meeting type (1=instant, 2=scheduled, 3=recurring no fixed time, 8=recurring fixed time)
  status?: string; // Meeting status
  start_time: string; // Start time (ISO 8601 format)
  duration: number; // Duration in minutes
  timezone?: string; // Timezone
  created_at: string; // Creation timestamp
  start_url: string; // Host join URL
  join_url: string; // Participant join URL
  password?: string; // Meeting password
  h323_password?: string; // H.323/SIP room system password
  pstn_password?: string; // PSTN password
  encrypted_password?: string; // Encrypted password
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    cn_meeting?: boolean;
    in_meeting?: boolean;
    join_before_host?: boolean;
    jbh_time?: number;
    mute_upon_entry?: boolean;
    watermark?: boolean;
    use_pmi?: boolean;
    approval_type?: number;
    audio?: string;
    auto_recording?: string;
    enforce_login?: boolean;
    enforce_login_domains?: string;
    alternative_hosts?: string;
    close_registration?: boolean;
    show_share_button?: boolean;
    allow_multiple_devices?: boolean;
    registrants_confirmation_email?: boolean;
    waiting_room?: boolean;
    request_permission_to_unmute_participants?: boolean;
    registrants_email_notification?: boolean;
    meeting_authentication?: boolean;
    encryption_type?: string;
    approved_or_denied_countries_or_regions?: {
      enable?: boolean;
    };
    breakout_room?: {
      enable?: boolean;
    };
    alternative_hosts_email_notification?: boolean;
    show_join_info?: boolean;
    device_testing?: boolean;
    focus_mode?: boolean;
    enable_dedicated_group_chat?: boolean;
    private_meeting?: boolean;
    email_notification?: boolean;
    host_save_video_order?: boolean;
    sign_language_interpretation?: {
      enable?: boolean;
    };
    email_in_attendee_report?: boolean;
  };
  pre_schedule?: boolean;
}

/**
 * Zoom Meeting Get Response (same as create response)
 */
export interface IZoomMeetingGetResponse extends IZoomMeetingCreateResponse {}

/**
 * Zoom Meeting API Client
 *
 * Handles authentication and API calls to Zoom platform
 * Uses Server-to-Server OAuth for authentication
 * https://developers.zoom.us/docs/internal-apps/s2s-oauth/
 * 
 * Note: All Zoom API requests are configured to bypass HTTP/HTTPS proxy
 * to avoid SSL/TLS issues. Zoom API endpoints should be directly accessible.
 */
@Injectable()
export class ZoomMeetingClient {
  private readonly logger = new Logger(ZoomMeetingClient.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly accountId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl = "https://api.zoom.us/v2";
  private readonly oauthUrl = "https://zoom.us/oauth";

  // Token cache
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  constructor(private readonly configService: ConfigService) {
    this.accountId = this.configService.get<string>("ZOOM_ACCOUNT_ID") || "";
    this.clientId = this.configService.get<string>("ZOOM_CLIENT_ID") || "";
    this.clientSecret = this.configService.get<string>("ZOOM_CLIENT_SECRET") || "";

    if (!this.accountId || !this.clientId || !this.clientSecret) {
      this.logger.warn(
        "Zoom ACCOUNT_ID, CLIENT_ID or CLIENT_SECRET not configured. Zoom meeting provider will not work.",
      );
    }

    // Configure axios to always disable proxy for all Zoom API requests
    // This ensures consistency and avoids SSL/TLS proxy-related issues
    // Both zoom.us (OAuth) and api.zoom.us (API) endpoints should be directly accessible
    const axiosConfig: Parameters<typeof axios.create>[0] = {
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
      proxy: false, // Disable proxy for all requests (OAuth + API)
    };

    this.axiosInstance = axios.create(axiosConfig);
    
    this.logger.log("Zoom API Client initialized (proxy disabled for all requests)");
  }

  /**
   * Get access token using Server-to-Server OAuth (with caching)
   *
   * According to Zoom API docs:
   * https://developers.zoom.us/docs/internal-apps/s2s-oauth/
   *
   * POST https://zoom.us/oauth/token?grant_type=account_credentials&account_id={accountId}
   * Authorization: Basic base64(clientId:clientSecret)
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    const now = Date.now();
    if (this.accessToken && this.tokenExpireTime > now) {
      return this.accessToken;
    }

    try {
      // Validate credentials before making request
      if (!this.accountId || !this.clientId || !this.clientSecret) {
        const missing = [];
        if (!this.accountId) missing.push('ZOOM_ACCOUNT_ID');
        if (!this.clientId) missing.push('ZOOM_CLIENT_ID');
        if (!this.clientSecret) missing.push('ZOOM_CLIENT_SECRET');
        
        throw new MeetingProviderAuthenticationException(
          "zoom",
          `Missing required environment variables: ${missing.join(', ')}. Please configure them in .env file.`,
        );
      }

      this.logger.debug(`Fetching new access token from Zoom (Account ID: ${this.accountId.substring(0, 8)}...)`);

      // Create Basic Auth header
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      // OAuth request - always disable proxy to avoid SSL/TLS issues
      const response = await axios.post<IZoomOAuthTokenResponse>(
        `${this.oauthUrl}/token`,
        null,
        {
          params: {
            grant_type: 'account_credentials',
            account_id: this.accountId,
          },
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          proxy: false, // Always disable proxy for Zoom OAuth
        }
      );

      if (!response.data.access_token) {
        throw new MeetingProviderAuthenticationException(
          "zoom",
          "No access token returned",
        );
      }

      this.accessToken = response.data.access_token;
      // Set expire time to expires_in seconds minus 5 minutes buffer
      this.tokenExpireTime = now + (response.data.expires_in - 300) * 1000;

      this.logger.debug("Successfully obtained Zoom access token");
      return this.accessToken;
    } catch (error) {
      if (error instanceof MeetingProviderAuthenticationException) {
        throw error;
      }

      if (axios.isAxiosError(error) && error.response) {
        const responseData = error.response.data as { 
          reason?: string; 
          error?: string;
          error_description?: string;
        };
        
        // Enhanced error message with more details
        const errorMessage = responseData?.reason 
          || responseData?.error 
          || responseData?.error_description 
          || error.message;
        
        this.logger.error(
          `Zoom OAuth failed: ${errorMessage}, status=${error.response.status}`,
        );
        this.logger.error(
          `OAuth Request Details - Account ID length: ${this.accountId?.length || 0}, ` +
          `Client ID length: ${this.clientId?.length || 0}, ` +
          `Client Secret length: ${this.clientSecret?.length || 0}`
        );
        
        // Log response data for debugging (without sensitive info)
        this.logger.debug(`Zoom API response: ${JSON.stringify(responseData)}`);

        throw new MeetingProviderAuthenticationException(
          "zoom",
          `Failed to get access token: ${errorMessage}. Please verify your ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET are correct.`,
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MeetingProviderAuthenticationException(
        "zoom",
        `Failed to get access token: ${message}`,
      );
    }
  }

  /**
   * Create a meeting
   *
   * According to Zoom API docs:
   * https://developers.zoom.us/docs/api/rest/reference/zoom-api/methods/#operation/meetingCreate
   *
   * POST /users/{userId}/meetings
   *
   * @param userId - Zoom user ID or email address or "me" for authenticated user
   * @param payload - Meeting creation payload
   * @returns Meeting info
   */
  async createMeeting(
    userId: string,
    payload: {
      topic: string;
      type?: number; // 1=instant, 2=scheduled (default), 3=recurring no fixed time, 8=recurring fixed time
      start_time?: string; // ISO 8601 format (required for type=2)
      duration?: number; // Duration in minutes
      timezone?: string; // Timezone (default: user's timezone)
      password?: string; // Meeting password
      agenda?: string; // Meeting description
      settings?: {
        host_video?: boolean; // Start video when host joins
        participant_video?: boolean; // Start video when participants join
        join_before_host?: boolean; // Allow participants to join before host
        mute_upon_entry?: boolean; // Mute participants upon entry
        watermark?: boolean; // Enable watermark
        use_pmi?: boolean; // Use Personal Meeting ID
        approval_type?: number; // 0=automatically approve, 1=manually approve, 2=no registration required
        audio?: string; // "both" (default), "telephony", "voip"
        auto_recording?: string; // "local", "cloud", "none" (default)
        waiting_room?: boolean; // Enable waiting room
        meeting_authentication?: boolean; // Require authentication to join
      };
    },
  ): Promise<IZoomMeetingCreateResponse> {
    const token = await this.getAccessToken();

    try {
      this.logger.debug(`Creating Zoom meeting for user: ${userId}`);

      const response = await this.axiosInstance.post<IZoomMeetingCreateResponse>(
        `/users/${userId}/meetings`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      this.logger.debug(
        `Successfully created Zoom meeting: ${response.data.id}`,
      );
      return response.data;
    } catch (error) {
      if (
        error instanceof MeetingProviderAPIException ||
        error instanceof MeetingProviderAuthenticationException
      ) {
        throw error;
      }

      if (axios.isAxiosError(error) && error.response) {
        const responseData = error.response.data as IZoomApiResponse;
        const message = responseData?.message || error.message || "Unknown Zoom API error";

        this.logger.error(
          `Zoom API error for POST /users/${userId}/meetings: code=${responseData?.code ?? error.response.status}, message=${message}`,
        );

        throw new MeetingProviderAPIException(
          "zoom",
          `/users/${userId}/meetings`,
          error.response.status,
          message,
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MeetingProviderAPIException(
        "zoom",
        `/users/${userId}/meetings`,
        500,
        message,
      );
    }
  }

  /**
   * Update a meeting
   *
   * PATCH /meetings/{meetingId}
   *
   * @param meetingId - Meeting ID
   * @param payload - Meeting update payload
   */
  async updateMeeting(
    meetingId: string,
    payload: {
      topic?: string;
      type?: number;
      start_time?: string;
      duration?: number;
      timezone?: string;
      password?: string;
      agenda?: string;
      settings?: {
        host_video?: boolean;
        participant_video?: boolean;
        join_before_host?: boolean;
        mute_upon_entry?: boolean;
        watermark?: boolean;
        auto_recording?: string;
        waiting_room?: boolean;
      };
    },
  ): Promise<void> {
    const token = await this.getAccessToken();

    try {
      this.logger.debug(`Updating Zoom meeting: ${meetingId}`);

      await this.axiosInstance.patch(
        `/meetings/${meetingId}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      this.logger.debug(`Successfully updated Zoom meeting: ${meetingId}`);
    } catch (error) {
      if (
        error instanceof MeetingProviderAPIException ||
        error instanceof MeetingProviderAuthenticationException
      ) {
        throw error;
      }

      if (axios.isAxiosError(error) && error.response) {
        const responseData = error.response.data as IZoomApiResponse;
        const message = responseData?.message || error.message;

        this.logger.error(
          `Zoom API error for PATCH /meetings/${meetingId}: message=${message}`,
        );

        throw new MeetingProviderAPIException(
          "zoom",
          `/meetings/${meetingId}`,
          error.response.status,
          message,
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MeetingProviderAPIException(
        "zoom",
        `/meetings/${meetingId}`,
        500,
        message,
      );
    }
  }

  /**
   * Delete a meeting
   *
   * DELETE /meetings/{meetingId}
   *
   * @param meetingId - Meeting ID
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    const token = await this.getAccessToken();

    try {
      this.logger.debug(`Deleting Zoom meeting: ${meetingId}`);

      await this.axiosInstance.delete(`/meetings/${meetingId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.logger.debug(`Successfully deleted Zoom meeting: ${meetingId}`);
    } catch (error) {
      if (
        error instanceof MeetingProviderAPIException ||
        error instanceof MeetingProviderAuthenticationException
      ) {
        throw error;
      }

      if (axios.isAxiosError(error) && error.response) {
        const responseData = error.response.data as IZoomApiResponse;
        const message = responseData?.message || error.message;

        this.logger.error(
          `Zoom API error for DELETE /meetings/${meetingId}: message=${message}`,
        );

        throw new MeetingProviderAPIException(
          "zoom",
          `/meetings/${meetingId}`,
          error.response.status,
          message,
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MeetingProviderAPIException(
        "zoom",
        `/meetings/${meetingId}`,
        500,
        message,
      );
    }
  }

  /**
   * Get meeting information
   *
   * GET /meetings/{meetingId}
   *
   * @param meetingId - Meeting ID
   * @returns Meeting info
   */
  async getMeeting(meetingId: string): Promise<IZoomMeetingGetResponse> {
    const token = await this.getAccessToken();

    try {
      this.logger.debug(`Fetching Zoom meeting info: ${meetingId}`);

      const response = await this.axiosInstance.get<IZoomMeetingGetResponse>(
        `/meetings/${meetingId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      this.logger.debug(`Successfully fetched Zoom meeting info: ${meetingId}`);
      return response.data;
    } catch (error) {
      if (
        error instanceof MeetingProviderAPIException ||
        error instanceof MeetingProviderAuthenticationException
      ) {
        throw error;
      }

      if (axios.isAxiosError(error) && error.response) {
        const responseData = error.response.data as IZoomApiResponse;
        const message = responseData?.message || error.message;

        this.logger.error(
          `Zoom API error for GET /meetings/${meetingId}: message=${message}`,
        );

        throw new MeetingProviderAPIException(
          "zoom",
          `/meetings/${meetingId}`,
          error.response.status,
          message,
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MeetingProviderAPIException(
        "zoom",
        `/meetings/${meetingId}`,
        500,
        message,
      );
    }
  }
}

