import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  RawBodyRequest,
  Req,
} from "@nestjs/common";
import { Request } from "express";
import { WebhookVerificationService } from "../services/webhook-verification.service";
import { WebhookHandlerRegistry } from "../handlers/webhook-handler.registry";
import {
  IFeishuWebhookRequest,
  IZoomWebhookRequest,
} from "../dto/webhook-event.dto";
import { IWebhookEvent } from "../interfaces/webhook-handler.interface";

/**
 * Webhook Gateway Controller
 *
 * HTTP entry point for receiving webhooks from different platforms
 * Handles signature verification and event dispatching
 */
@Controller("webhooks")
export class WebhookGatewayController {
  private readonly logger = new Logger(WebhookGatewayController.name);

  constructor(
    private readonly verificationService: WebhookVerificationService,
    private readonly handlerRegistry: WebhookHandlerRegistry,
  ) {}

  /**
   * Handle Feishu (Lark) webhook
   *
   * POST /webhooks/feishu
   *
   * @param request - Raw request with body
   * @param headers - Request headers
   * @param body - Webhook payload
   */
  @Post("feishu")
  @HttpCode(HttpStatus.OK)
  async handleFeishuWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
    @Body() body: IFeishuWebhookRequest,
  ): Promise<{ challenge?: string }> {
    this.logger.debug("Received Feishu webhook");

    // Handle URL verification challenge
    if (body.type === "url_verification" && body.challenge) {
      this.logger.log("Handling Feishu URL verification challenge");

      // Verify token
      if (body.token) {
        this.verificationService.verifyFeishuToken(body.token);
      }

      return { challenge: body.challenge };
    }

    // Verify webhook signature
    const rawBody = request.rawBody?.toString("utf-8") || JSON.stringify(body);
    this.verificationService.verifyFeishuWebhook(headers, rawBody);

    // Extract event data
    const event = this.extractFeishuEvent(body);

    if (!event) {
      this.logger.warn("No event data found in Feishu webhook");
      return {};
    }

    // Dispatch event to handler
    await this.handlerRegistry.dispatchEvent(event);

    return {};
  }

  /**
   * Handle Zoom webhook
   *
   * POST /webhooks/zoom
   *
   * @param request - Raw request with body
   * @param headers - Request headers
   * @param body - Webhook payload
   */
  @Post("zoom")
  @HttpCode(HttpStatus.OK)
  async handleZoomWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
    @Body() body: IZoomWebhookRequest,
  ): Promise<void> {
    this.logger.debug("Received Zoom webhook");

    // Verify webhook signature
    const rawBody = request.rawBody?.toString("utf-8") || JSON.stringify(body);
    this.verificationService.verifyZoomWebhook(headers, rawBody);

    // Extract event data
    const event = this.extractZoomEvent(body);

    if (!event) {
      this.logger.warn("No event data found in Zoom webhook");
      return;
    }

    // Dispatch event to handler
    await this.handlerRegistry.dispatchEvent(event);
  }

  /**
   * Extract event from Feishu webhook payload
   */
  private extractFeishuEvent(
    payload: IFeishuWebhookRequest,
  ): IWebhookEvent | null {
    // Handle v2.0 event structure (with header)
    if (payload.header && payload.header.event_type) {
      return {
        eventType: payload.header.event_type,
        eventData: payload.event || payload,
        timestamp: parseInt(payload.header.create_time, 10),
        eventId: payload.header.event_id,
      };
    }

    // Handle v1.0 event structure (legacy)
    if (payload.event && payload.event.type) {
      return {
        eventType: payload.event.type,
        eventData: payload.event,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  /**
   * Extract event from Zoom webhook payload
   */
  private extractZoomEvent(payload: IZoomWebhookRequest): IWebhookEvent | null {
    if (!payload.event) {
      return null;
    }

    return {
      eventType: payload.event,
      eventData: payload.payload,
      timestamp: payload.event_ts,
    };
  }
}
