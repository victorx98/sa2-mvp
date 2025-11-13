import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import {
  IFeishuCard,
  IFeishuMessageRequest,
} from "../interfaces/feishu-bot.interface";
import { ISessionEntity } from "@domains/services/session/interfaces/session.interface";

/**
 * Feishu Bot Service
 *
 * Sends messages and cards to Feishu users
 * Uses Feishu Bot API
 */
@Injectable()
export class FeishuBotService {
  private readonly logger = new Logger(FeishuBotService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl = "https://open.feishu.cn/open-apis";

  private tenantAccessToken: string | null = null;
  private tokenExpireTime = 0;

  constructor(private readonly configService: ConfigService) {
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Send card message to user
   *
   * @param userId - Feishu user open_id
   * @param card - Card content
   */
  async sendCard(userId: string, card: IFeishuCard): Promise<void> {
    this.logger.debug(`Sending card to user: ${userId}`);

    try {
      const token = await this.getTenantAccessToken();

      const request: IFeishuMessageRequest = {
        receive_id: userId,
        msg_type: "interactive",
        content: JSON.stringify({ card }),
      };

      const response = await this.httpClient.post("/im/v1/messages", request, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: {
          receive_id_type: "open_id",
        },
      });

      if (response.data.code !== 0) {
        throw new Error(`Feishu API error: ${response.data.msg}`);
      }

      this.logger.log(`Card sent successfully to user: ${userId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send card to ${userId}: ${message}`);
      throw error;
    }
  }

  /**
   * Send text message to user
   *
   * @param userId - Feishu user open_id
   * @param text - Text content
   */
  async sendTextMessage(userId: string, text: string): Promise<void> {
    this.logger.debug(`Sending text message to user: ${userId}`);

    try {
      const token = await this.getTenantAccessToken();

      const request: IFeishuMessageRequest = {
        receive_id: userId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      };

      const response = await this.httpClient.post("/im/v1/messages", request, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: {
          receive_id_type: "open_id",
        },
      });

      if (response.data.code !== 0) {
        throw new Error(`Feishu API error: ${response.data.msg}`);
      }

      this.logger.log(`Text message sent successfully to user: ${userId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send text message to ${userId}: ${message}`);
      throw error;
    }
  }

  /**
   * Send session summary card
   *
   * @param session - Session entity
   * @param userId - Feishu user open_id
   */
  async sendSessionSummaryCard(
    session: ISessionEntity,
    userId: string,
  ): Promise<void> {
    this.logger.debug(
      `Sending session summary card for session: ${session.id}`,
    );

    const card: IFeishuCard = {
      config: {
        wide_screen_mode: true,
        enable_forward: true,
      },
      header: {
        title: {
          tag: "plain_text",
          content: "约课总结",
        },
        template: "blue",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: `**约课名称**: ${session.sessionName}`,
          },
        },
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: `**开始时间**: ${session.scheduledStartTime.toLocaleString("zh-CN")}`,
          },
        },
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: `**实际时长**: ${session.actualServiceDuration || 0} 分钟`,
          },
        },
        {
          tag: "hr",
        },
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: session.notes || "暂无备注",
          },
        },
      ],
    };

    // Add recording link if available
    if (session.recordings.length > 0) {
      card.elements.push({
        tag: "action",
        actions: [
          {
            tag: "button",
            text: {
              tag: "plain_text",
              content: "查看录制",
            },
            type: "primary",
            url: session.recordings[0].recordingUrl,
          },
        ],
      });
    }

    await this.sendCard(userId, card);
  }

  /**
   * Get tenant access token with caching
   *
   * @returns Tenant access token
   */
  private async getTenantAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if valid
    if (this.tenantAccessToken && this.tokenExpireTime > now) {
      return this.tenantAccessToken;
    }

    this.logger.debug("Fetching new tenant access token");

    const appId = this.configService.get<string>("FEISHU_BOT_APP_ID");
    const appSecret = this.configService.get<string>("FEISHU_BOT_APP_SECRET");

    if (!appId || !appSecret) {
      throw new Error("Feishu Bot credentials not configured");
    }

    try {
      const response = await this.httpClient.post(
        "/auth/v3/tenant_access_token/internal",
        {
          app_id: appId,
          app_secret: appSecret,
        },
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to get token: ${response.data.msg}`);
      }

      const { tenant_access_token, expire } = response.data;

      // Cache token with 5 minute buffer before expiration
      this.tenantAccessToken = tenant_access_token;
      this.tokenExpireTime = now + (expire - 300) * 1000;

      this.logger.log("Tenant access token refreshed successfully");

      return tenant_access_token;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get tenant access token: ${message}`);
      throw error;
    }
  }
}
