import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import {
  MeetingProviderAuthenticationException,
  MeetingProviderAPIException,
} from "../exceptions/meeting-provider.exception";

/**
 * Feishu API Response structure for general endpoints
 * Some endpoints return data directly in the response, not in a nested 'data' field
 */
interface IFeishuApiResponse<T = unknown> {
  code: number;
  msg: string;
  data?: T;
}

/**
 * Feishu Tenant Access Token Response
 * This endpoint returns the response with code and msg at the top level
 */
interface ITenantAccessTokenResponse {
  code: number;
  msg: string;
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
   *
   * According to Feishu API docs:
   * https://open.feishu.cn/document/server-docs/authentication-management/access-token/tenant_access_token_internal
   *
   * The tenant_access_token endpoint returns the token data directly in the response,
   * not in a nested 'data' field like other Feishu API endpoints.
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
        ITenantAccessTokenResponse
      >("/auth/v3/tenant_access_token/internal", {
        app_id: this.appId,
        app_secret: this.appSecret,
      });

      // Validate response code
      if (response.data.code !== 0) {
        throw new MeetingProviderAuthenticationException(
          "feishu",
          `Failed to get tenant access token: ${response.data.msg}`,
        );
      }

      // Extract token data directly from response (not nested in 'data' field)
      const tokenData = response.data;
      if (!tokenData.tenant_access_token) {
        throw new MeetingProviderAuthenticationException(
          "feishu",
          "No tenant access token returned",
        );
      }

      this.tenantAccessToken = tokenData.tenant_access_token;
      // Set expire time to expire seconds minus 5 minutes buffer
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
 * According to Feishu API docs: https://open.feishu.cn/document/server-docs/vc-v1/reserve/apply
 *
 * Required fields when using tenant_access_token:
 * - end_time: Unix timestamp in seconds (string)
 * - owner_id: Feishu user ID (open_id/union_id) within the same tenant
 * - meeting_settings: Reserve meeting configuration
 *
 * @param payload - Reserve apply payload
 * @returns Reserve info
 */
  async applyReservation(payload: {
    end_time: string | number; // Unix timestamp in seconds, MUST be integer
    owner_id: string; // Feishu user ID that owns the meeting
    meeting_settings: {
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

      const endTimeNumber = Number(payload.end_time);

      if (!Number.isFinite(endTimeNumber)) {
        throw new MeetingProviderAPIException(
          "feishu",
          "/vc/v1/reserves/apply",
          400,
          "end_time must be a valid Unix timestamp number",
        );
      }

      if (!payload.owner_id) {
        throw new MeetingProviderAPIException(
          "feishu",
          "/vc/v1/reserves/apply",
          400,
          "owner_id is required when using tenant access token",
        );
      }

      const normalizedPayload = {
        end_time: Math.floor(endTimeNumber).toString(),
        owner_id: payload.owner_id,
        meeting_settings: payload.meeting_settings,
      };

      this.logger.debug(
        `Feishu API request payload: ${JSON.stringify(normalizedPayload)}`,
      );

      const response = await this.axiosInstance.post<
        IFeishuApiResponse<IFeishuReserveApplyResponse>
      >("/vc/v1/reserves/apply", normalizedPayload, {
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

      if (axios.isAxiosError(error) && error.response) {
        const responseData = error.response.data as {
          code?: number;
          msg?: string;
          error?: { code?: number; message?: string };
        };

        const apiCode = responseData?.code ?? responseData?.error?.code;
        const apiMsg =
          responseData?.msg ??
          responseData?.error?.message ??
          (error.message || "Unknown Feishu API error");

        this.logger.error(
          `Feishu API returned error for /vc/v1/reserves/apply: code=${apiCode ?? error.response.status}, msg=${apiMsg}, raw=${JSON.stringify(responseData)}`,
        );

        throw new MeetingProviderAPIException(
          "feishu",
          "/vc/v1/reserves/apply",
          apiCode ?? error.response.status ?? 500,
          apiMsg,
        );
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
