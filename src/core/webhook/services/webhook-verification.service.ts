import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { WebhookSignatureVerificationException } from "../exceptions/webhook.exception";

/**
 * Webhook Verification Service
 *
 * Handles signature verification for webhooks from different platforms
 */
@Injectable()
export class WebhookVerificationService {
  private readonly logger = new Logger(WebhookVerificationService.name);
  private readonly feishuEncryptKey: string;
  private readonly feishuVerificationToken: string;
  private readonly zoomWebhookSecretToken: string;

  constructor(private readonly configService: ConfigService) {
    this.feishuEncryptKey =
      this.configService.get<string>("FEISHU_ENCRYPT_KEY") || "";
    this.feishuVerificationToken =
      this.configService.get<string>("FEISHU_VERIFICATION_TOKEN") || "";
    this.zoomWebhookSecretToken =
      this.configService.get<string>("ZOOM_WEBHOOK_SECRET_TOKEN") || "";
  }

  /**
   * Verify Feishu webhook signature
   *
   * Feishu uses timestamp + nonce + encrypt_key to generate signature
   * @param timestamp - Request timestamp
   * @param nonce - Random nonce
   * @param body - Request body (stringified)
   * @param signature - Signature from request header
   * @returns True if signature is valid
   */
  verifyFeishuSignature(
    timestamp: string,
    nonce: string,
    body: string,
    signature: string,
  ): boolean {
    try {
      if (!this.feishuEncryptKey) {
        this.logger.warn(
          "FEISHU_ENCRYPT_KEY not configured, skipping signature verification",
        );
        return true; // Skip verification if not configured (development mode)
      }

      // Feishu signature calculation: SHA256(timestamp + nonce + encrypt_key + body)
      const content = timestamp + nonce + this.feishuEncryptKey + body;
      const hash = crypto.createHash("sha256").update(content).digest("hex");

      const isValid = hash === signature;

      if (!isValid) {
        this.logger.warn(
          `Feishu signature verification failed. Expected: ${hash}, Got: ${signature}`,
        );
      }

      return isValid;
    } catch (error) {
      this.logger.error(
        `Error verifying Feishu signature: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Verify Feishu webhook token (for URL verification)
   *
   * @param token - Token from request
   * @returns True if token is valid
   */
  verifyFeishuToken(token: string): boolean {
    if (!this.feishuVerificationToken) {
      this.logger.warn(
        "FEISHU_VERIFICATION_TOKEN not configured, skipping token verification",
      );
      return true;
    }

    const isValid = token === this.feishuVerificationToken;

    if (!isValid) {
      this.logger.warn("Feishu token verification failed");
    }

    return isValid;
  }

  /**
   * Verify Zoom webhook signature
   *
   * Zoom uses HMAC-SHA256 with message: v0:{timestamp}:{request_body}
   * @param timestamp - Request timestamp from header
   * @param body - Request body (stringified)
   * @param signature - Signature from request header (format: v0=<signature>)
   * @returns True if signature is valid
   */
  verifyZoomSignature(
    timestamp: string,
    body: string,
    signature: string,
  ): boolean {
    try {
      if (!this.zoomWebhookSecretToken) {
        this.logger.warn(
          "ZOOM_WEBHOOK_SECRET_TOKEN not configured, skipping signature verification",
        );
        return true;
      }

      // Zoom signature format: v0=<signature>
      const signatureParts = signature.split("=");
      if (signatureParts.length !== 2 || signatureParts[0] !== "v0") {
        this.logger.warn("Invalid Zoom signature format");
        return false;
      }

      const providedSignature = signatureParts[1];

      // Zoom signature calculation: HMAC-SHA256(secret, "v0:{timestamp}:{body}")
      const message = `v0:${timestamp}:${body}`;
      const hash = crypto
        .createHmac("sha256", this.zoomWebhookSecretToken)
        .update(message)
        .digest("hex");

      const isValid = hash === providedSignature;

      if (!isValid) {
        this.logger.warn(
          `Zoom signature verification failed. Expected: ${hash}, Got: ${providedSignature}`,
        );
      }

      return isValid;
    } catch (error) {
      this.logger.error(
        `Error verifying Zoom signature: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Verify Feishu webhook request using Verification Token mode (without Encrypt Key)
   *
   * In Verification Token mode, Feishu sends events without computing a signature.
   * Verification relies on:
   * 1. Checking the token in the request body matches the configured verification token
   * 2. Validating the timestamp to prevent replay attacks (5 minute tolerance)
   *
   * @param body - Request body (parsed JSON)
   * @throws WebhookSignatureVerificationException if verification fails
   */
  verifyFeishuWebhookByToken(
    body: Record<string, unknown>,
  ): void {
    // Extract token from request body
    const token = (body.header as Record<string, unknown>)?.token as string || "";

    if (!token) {
      this.logger.warn("Missing Feishu verification token in request body");
      throw new WebhookSignatureVerificationException("Feishu");
    }

    // Verify token matches configured verification token
    if (!this.verifyFeishuToken(token)) {
      this.logger.warn("Feishu webhook token verification failed");
      throw new WebhookSignatureVerificationException("Feishu");
    }

    // Check timestamp to prevent replay attacks (5 minutes tolerance)
    const createTime = (body.header as Record<string, unknown>)?.create_time as string || "";
    if (createTime) {
      const requestTime = parseInt(createTime, 10) / 1000; // Convert milliseconds to seconds
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTime - requestTime);

      if (timeDiff > 300) {
        this.logger.warn(
          `Feishu webhook timestamp too old: ${timeDiff} seconds difference`,
        );
        throw new WebhookSignatureVerificationException("Feishu");
      }
    }

    this.logger.debug("Feishu webhook token verified successfully");
  }

  /**
   * Verify Feishu webhook request using Encrypt Key mode
   *
   * When Encrypt Key is enabled, Feishu computes a signature using:
   * SHA256(timestamp + nonce + encrypt_key + body) and sends it in X-Lark-Signature header
   *
   * @param headers - Request headers
   * @param body - Request body (stringified)
   * @throws WebhookSignatureVerificationException if verification fails
   */
  verifyFeishuWebhook(headers: Record<string, string>, body: string): void {
    const timestamp = headers["x-lark-request-timestamp"] || "";
    const nonce = headers["x-lark-request-nonce"] || "";
    const signature = headers["x-lark-signature"] || "";

    if (!timestamp || !nonce || !signature) {
      this.logger.warn("Missing Feishu signature headers");
      throw new WebhookSignatureVerificationException("Feishu");
    }

    // Check timestamp to prevent replay attacks (5 minutes tolerance)
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - requestTime);

    if (timeDiff > 300) {
      this.logger.warn(
        `Feishu webhook timestamp too old: ${timeDiff} seconds difference`,
      );
      throw new WebhookSignatureVerificationException("Feishu");
    }

    // Verify signature
    const isValid = this.verifyFeishuSignature(
      timestamp,
      nonce,
      body,
      signature,
    );

    if (!isValid) {
      throw new WebhookSignatureVerificationException("Feishu");
    }

    this.logger.debug("Feishu webhook signature verified successfully");
  }

  /**
   * Verify Zoom webhook request
   *
   * @param headers - Request headers
   * @param body - Request body (stringified)
   * @throws WebhookSignatureVerificationException if verification fails
   */
  verifyZoomWebhook(headers: Record<string, string>, body: string): void {
    const timestamp = headers["x-zm-request-timestamp"] || "";
    const signature = headers["x-zm-signature"] || "";

    if (!timestamp || !signature) {
      this.logger.warn("Missing Zoom signature headers");
      throw new WebhookSignatureVerificationException("Zoom");
    }

    // Verify signature
    const isValid = this.verifyZoomSignature(timestamp, body, signature);

    if (!isValid) {
      throw new WebhookSignatureVerificationException("Zoom");
    }

    this.logger.debug("Zoom webhook signature verified successfully");
  }
}
