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
import { FeishuWebhookHandler } from "../handlers/feishu-webhook.handler";
import { ZoomWebhookHandler } from "../handlers/zoom-webhook.handler";
import {
  IFeishuWebhookRequest,
  IZoomWebhookRequest,
} from "../dto/webhook-event.dto";

/**
 * Webhook Gateway Controller
 *
 * Pure HTTP gateway for receiving webhooks from different platforms
 * Responsibilities:
 * 1. Handle URL verification challenges
 * 2. Verify security (token/signature)
 * 3. Forward to platform-specific handlers
 * 
 * NO business routing logic - handlers are kept minimal
 */
@Controller("webhooks")
export class WebhookGatewayController {
  private readonly logger = new Logger(WebhookGatewayController.name);

  constructor(
    private readonly verificationService: WebhookVerificationService,
    private readonly feishuHandler: FeishuWebhookHandler,
    private readonly zoomHandler: ZoomWebhookHandler,
  ) {}

  /**
   * Handle Feishu (Lark) webhook
   *
   * POST /webhooks/feishu
   *
   * Supports two verification modes:
   * 1. Verification Token mode: Verifies the token in the request body
   * 2. Encrypt Key mode: Verifies the signature in request headers
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

    // Handle URL verification challenge (initial configuration on Feishu platform)
    if (body.type === "url_verification" && body.challenge) {
      this.logger.log("Handling Feishu URL verification challenge");

      // Verify token during challenge
      if (body.token) {
        this.verificationService.verifyFeishuToken(body.token);
      }

      return { challenge: body.challenge };
    }

    // Verify event webhook using appropriate mode
    // In this case, verify using the token in the request body
    // Use Verification Token mode - verify the token in the request body
    this.verificationService.verifyFeishuWebhookByToken(body as Record<string, unknown>);

    // Forward to handler (no routing logic here)
    await this.feishuHandler.handle(body);

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

    // Forward to handler (no routing logic here)
    await this.zoomHandler.handle(body);
  }
}
