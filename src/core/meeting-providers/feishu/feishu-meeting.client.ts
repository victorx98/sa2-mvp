import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import {
  MeetingProviderAuthenticationException,
  MeetingProviderAPIException,
} from "../exceptions/meeting-provider.exception";

/**
 * Feishu API Response structure
 */
interface IFeishuApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

/**
 * Feishu Tenant Access Token Response
 */
interface ITenantAccessTokenResponse {
  tenant_access_token: string;
  expire: number;
}

/**
 * Feishu Reserve Apply Response
 */
interface IFeishuReserveApplyResponse {
  reserve: {
    id: string; // Reserve ID
    meeting_no: string; // 9-digit meeting number
    url: string; // Meeting URL
    live_link: string; // Live link
    end_time: string; // End time
  };
}

/**
 * Feishu Reserve Info Response
 */
interface IFeishuReserveInfoResponse {
  reserve: {
    id: string;
    meeting_no: string;
    url: string;
    live_link: string;
    end_time: string;
    topic: string;
    meeting_start_time: string;
    meeting_duration: number;
    owner: {
      id: string;
      user_type: number;
    };
  };
}

/**
 * Feishu Meeting API Client
 *
 * Handles authentication and API calls to Feishu Open Platform
 */
@Injectable()
export class FeishuMeetingClient {
  private readonly logger = new Logger(FeishuMeetingClient.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly baseUrl = "https://open.feishu.cn/open-apis";

  // Token cache
  private tenantAccessToken: string | null = null;
  private tokenExpireTime: number = 0;

  constructor(private readonly configService: ConfigService) {
    this.appId = this.configService.get<string>("FEISHU_APP_ID") || "";
    this.appSecret = this.configService.get<string>("FEISHU_APP_SECRET") || "";

    if (!this.appId || !this.appSecret) {
      this.logger.warn(
        "Feishu APP_ID or APP_SECRET not configured. Feishu meeting provider will not work.",
      );
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Get tenant access token (with caching)
   */
  private async getTenantAccessToken(): Promise<string> {
    // Return cached token if still valid
    const now = Date.now();
    if (this.tenantAccessToken && this.tokenExpireTime > now) {
      return this.tenantAccessToken;
    }

    try {
      this.logger.debug("Fetching new tenant access token from Feishu");

      const response = await this.axiosInstance.post<
        IFeishuApiResponse<ITenantAccessTokenResponse>
      >("/auth/v3/tenant_access_token/internal", {
        app_id: this.appId,
        app_secret: this.appSecret,
      });

      if (response.data.code !== 0) {
        throw new MeetingProviderAuthenticationException(
          "feishu",
          `Failed to get tenant access token: ${response.data.msg}`,
        );
      }

      const tokenData = response.data.data;
      if (!tokenData) {
        throw new MeetingProviderAuthenticationException(
          "feishu",
          "No token data returned",
        );
      }

      this.tenantAccessToken = tokenData.tenant_access_token;
      // Set expire time to 1 hour minus 5 minutes buffer
      this.tokenExpireTime = now + (tokenData.expire - 300) * 1000;

      this.logger.debug("Successfully obtained tenant access token");
      return this.tenantAccessToken;
    } catch (error) {
      if (error instanceof MeetingProviderAuthenticationException) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MeetingProviderAuthenticationException(
        "feishu",
        `Failed to get tenant access token: ${message}`,
      );
    }
  }

  /**
   * Apply for a meeting reservation
   *
   * @param payload - Reserve apply payload
   * @returns Reserve info
   */
  async applyReservation(payload: {
    end_time: string; // Unix timestamp in seconds
    meeting_settings?: {
      topic?: string;
      action_permissions?: number[];
      meeting_initial_type?: number;
      call_setting?: {
        callee?: {
          id?: string;
          user_type?: number;
          pstn_sip_info?: {
            nickname?: string;
            main_address?: string;
          };
        };
      };
      auto_record?: boolean;
      open_lobby?: boolean;
      allow_attendees_start?: boolean;
    };
  }): Promise<IFeishuReserveApplyResponse> {
    const token = await this.getTenantAccessToken();

    try {
      this.logger.debug("Applying for Feishu meeting reservation");

      const response = await this.axiosInstance.post<
        IFeishuApiResponse<IFeishuReserveApplyResponse>
      >("/vc/v1/reserves/apply", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.code !== 0) {
        throw new MeetingProviderAPIException(
          "feishu",
          "/vc/v1/reserves/apply",
          response.data.code,
          response.data.msg,
        );
      }

      if (!response.data.data) {
        throw new MeetingProviderAPIException(
          "feishu",
          "/vc/v1/reserves/apply",
          500,
          "No data returned from Feishu API",
        );
      }

      this.logger.debug(
        `Successfully created Feishu reservation: ${response.data.data.reserve.id}`,
      );
      return response.data.data;
    } catch (error) {
      if (
        error instanceof MeetingProviderAPIException ||
        error instanceof MeetingProviderAuthenticationException
      ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MeetingProviderAPIException(
        "feishu",
        "/vc/v1/reserves/apply",
        500,
        message,
      );
    }
  }

  /**
   * Update a meeting reservation
   *
   * @param reserveId - Reserve ID
   * @param payload - Update payload
   */
  async updateReservation(
    reserveId: string,
    payload: {
      end_time?: string;
      meeting_settings?: {
        topic?: string;
        auto_record?: boolean;
        open_lobby?: boolean;
        allow_attendees_start?: boolean;
      };
    },
  ): Promise<void> {
    const token = await this.getTenantAccessToken();

    try {
      this.logger.debug(`Updating Feishu reservation: ${reserveId}`);

      const response = await this.axiosInstance.put<IFeishuApiResponse>(
        `/vc/v1/reserves/${reserveId}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.code !== 0) {
        throw new MeetingProviderAPIException(
          "feishu",
          `/vc/v1/reserves/${reserveId}`,
          response.data.code,
          response.data.msg,
        );
      }

      this.logger.debug(
        `Successfully updated Feishu reservation: ${reserveId}`,
      );
    } catch (error) {
      if (
        error instanceof MeetingProviderAPIException ||
        error instanceof MeetingProviderAuthenticationException
      ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MeetingProviderAPIException(
        "feishu",
        `/vc/v1/reserves/${reserveId}`,
        500,
        message,
      );
    }
  }

  /**
   * Delete a meeting reservation
   *
   * @param reserveId - Reserve ID
   */
  async deleteReservation(reserveId: string): Promise<void> {
    const token = await this.getTenantAccessToken();

    try {
      this.logger.debug(`Deleting Feishu reservation: ${reserveId}`);

      const response = await this.axiosInstance.delete<IFeishuApiResponse>(
        `/vc/v1/reserves/${reserveId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.code !== 0) {
        throw new MeetingProviderAPIException(
          "feishu",
          `/vc/v1/reserves/${reserveId}`,
          response.data.code,
          response.data.msg,
        );
      }

      this.logger.debug(
        `Successfully deleted Feishu reservation: ${reserveId}`,
      );
    } catch (error) {
      if (
        error instanceof MeetingProviderAPIException ||
        error instanceof MeetingProviderAuthenticationException
      ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MeetingProviderAPIException(
        "feishu",
        `/vc/v1/reserves/${reserveId}`,
        500,
        message,
      );
    }
  }

  /**
   * Get meeting reservation info
   *
   * @param reserveId - Reserve ID
   * @returns Reserve info
   */
  async getReservationInfo(
    reserveId: string,
  ): Promise<IFeishuReserveInfoResponse> {
    const token = await this.getTenantAccessToken();

    try {
      this.logger.debug(`Fetching Feishu reservation info: ${reserveId}`);

      const response = await this.axiosInstance.get<
        IFeishuApiResponse<IFeishuReserveInfoResponse>
      >(`/vc/v1/reserves/${reserveId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.code !== 0) {
        throw new MeetingProviderAPIException(
          "feishu",
          `/vc/v1/reserves/${reserveId}`,
          response.data.code,
          response.data.msg,
        );
      }

      if (!response.data.data) {
        throw new MeetingProviderAPIException(
          "feishu",
          `/vc/v1/reserves/${reserveId}`,
          500,
          "No data returned from Feishu API",
        );
      }

      this.logger.debug(
        `Successfully fetched Feishu reservation info: ${reserveId}`,
      );
      return response.data.data;
    } catch (error) {
      if (
        error instanceof MeetingProviderAPIException ||
        error instanceof MeetingProviderAuthenticationException
      ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw new MeetingProviderAPIException(
        "feishu",
        `/vc/v1/reserves/${reserveId}`,
        500,
        message,
      );
    }
  }
}
