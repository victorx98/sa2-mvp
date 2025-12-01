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
   * POST /webhooks/feishuWebHookHandler
   *
   * Supports two verification modes:
   * 1. Verification Token mode: Verifies the token in the request body
   * 2. Encrypt Key mode: Verifies the signature in request headers
   *
   * @param request - Raw request with body
   * @param headers - Request headers
   * @param body - Webhook payload
   */
  @Post("feishuWebHookHandler")
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
   * POST /webhooks/zoomWebHookHandler
   *
   * Handles:
   * 1. URL validation (endpoint.url_validation event) - uses HMAC-SHA256
   * 2. Event webhooks - uses simple Authorization header check
   *
   * @param request - Raw request with body
   * @param headers - Request headers
   * @param body - Webhook payload
   */
  @Post("zoomWebHookHandler")
  @HttpCode(HttpStatus.OK)
  async handleZoomWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
    @Body() body: any,
  ): Promise<any> {
    this.logger.debug(`Received Zoom webhook: ${body.event}`);

    // Handle URL validation challenge (Zoom sends this when configuring webhook endpoint)
    if (body.event === "endpoint.url_validation") {
      this.logger.log("Handling Zoom URL validation challenge");

      // Extract plainToken
      const plainToken = body.payload?.plainToken;

      if (!plainToken) {
        this.logger.error("Missing plainToken in Zoom validation request");
        throw new Error("Invalid Zoom validation request");
      }

      // Generate encrypted token using HMAC-SHA256
      const encryptedToken = this.verificationService.generateZoomEncryptedToken(plainToken);

      this.logger.log("Zoom URL validation successful");
      return {
        plainToken,
        encryptedToken,
      };
    }

    // Verify event webhook using Authorization header (simple check)
    this.verificationService.verifyZoomWebhook(headers);

    // Forward to handler (no routing logic here)
    await this.zoomHandler.handle(body as IZoomWebhookRequest);

    return {};
  }
}
