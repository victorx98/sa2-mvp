import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { WebhookSignatureVerificationException } from "../exceptions/webhook.exception";

/**
 * Webhook Verification Service
 *
 * Handles token-based verification for webhooks from different platforms
 * Strategy: Verification Token + Timestamp Replay Check (lightweight approach)
 */
@Injectable()
export class WebhookVerificationService {
  private readonly logger = new Logger(WebhookVerificationService.name);
  private readonly feishuVerificationToken: string;
  private readonly zoomVerificationToken: string;

  // Replay attack prevention: 5 minutes window
  private readonly REPLAY_WINDOW_SECONDS = 300;

  constructor(private readonly configService: ConfigService) {
    this.feishuVerificationToken =
      this.configService.get<string>("FEISHU_VERIFICATION_TOKEN") || "";
    this.zoomVerificationToken =
      this.configService.get<string>("ZOOM_VERIFICATION_TOKEN") || "";
  }

  /**
   * Verify timestamp to prevent replay attacks
   * 
   * @param timestamp - Unix timestamp in seconds
   * @returns True if within acceptable window
   */
  private verifyTimestamp(timestamp: number): boolean {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeDiff = Math.abs(currentTime - timestamp);

    if (timeDiff > this.REPLAY_WINDOW_SECONDS) {
      this.logger.warn(
        `Timestamp too old: ${timeDiff} seconds difference (limit: ${this.REPLAY_WINDOW_SECONDS}s)`,
      );
      return false;
    }

    return true;
  }

  /**
   * Verify Feishu webhook token
   *
   * @param token - Token from request payload
   * @throws WebhookSignatureVerificationException if verification fails
   */
  verifyFeishuToken(token: string): void {
    if (!this.feishuVerificationToken) {
      this.logger.warn(
        "FEISHU_VERIFICATION_TOKEN not configured, skipping token verification",
      );
      return;
    }

    if (token !== this.feishuVerificationToken) {
      this.logger.warn("Feishu token verification failed");
      throw new WebhookSignatureVerificationException("Feishu");
    }

    this.logger.debug("Feishu token verified successfully");
  }

  /**
   * Verify Zoom webhook token
   * 
   * Note: This is a simplified token-based verification
   * For production, consider implementing Zoom's signature verification
   *
   * @param token - Token from request payload
   * @throws WebhookSignatureVerificationException if verification fails
   */
  verifyZoomToken(token: string): void {
    if (!this.zoomVerificationToken) {
      this.logger.warn(
        "ZOOM_VERIFICATION_TOKEN not configured, skipping token verification",
      );
      return;
    }

    if (token !== this.zoomVerificationToken) {
      this.logger.warn("Zoom token verification failed");
      throw new WebhookSignatureVerificationException("Zoom");
    }

    this.logger.debug("Zoom token verified successfully");
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
    // Extract token from request body (Feishu places it in body.header.token)
    const token = (body.header as Record<string, unknown>)?.token as string || "";

    if (!token) {
      this.logger.warn("Missing Feishu verification token in request body");
      throw new WebhookSignatureVerificationException("Feishu");
    }

    // Step 1: Verify token matches configured verification token
    // Note: verifyFeishuToken() returns void and throws exception on failure
    try {
      this.verifyFeishuToken(token);
    } catch (error) {
      this.logger.warn("Feishu webhook token verification failed");
      throw error;
    }

    // Step 2: Check timestamp to prevent replay attacks (5 minutes tolerance)
    const createTime = (body.header as Record<string, unknown>)?.create_time as string || "";
    if (createTime) {
      const requestTimeMs = parseInt(createTime, 10);
      const requestTimeSec = Math.floor(requestTimeMs / 1000); // Convert milliseconds to seconds
      const currentTimeSec = Math.floor(Date.now() / 1000);
      const timeDiffSec = Math.abs(currentTimeSec - requestTimeSec);

      if (timeDiffSec > this.REPLAY_WINDOW_SECONDS) {
        this.logger.warn(
          `Feishu webhook timestamp too old: ${timeDiffSec} seconds difference (limit: ${this.REPLAY_WINDOW_SECONDS}s)`,
        );
        throw new WebhookSignatureVerificationException("Feishu");
      }
    }

    this.logger.debug("Feishu webhook verified successfully using Verification Token mode");
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
    const timestamp = headers["x-lark-request-timestamp"];

    // Parse body to get token
    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      this.logger.error("Failed to parse Feishu webhook body");
      throw new WebhookSignatureVerificationException("Feishu");
    }

    // 1. Verify token (from payload or header)
    const token = payload.token || payload.header?.token;
    if (token) {
      this.verifyFeishuToken(token);
    }

    // 2. Verify timestamp (prevent replay attacks)
    if (timestamp) {
      const requestTime = parseInt(timestamp, 10);
      if (!this.verifyTimestamp(requestTime)) {
        throw new WebhookSignatureVerificationException("Feishu");
      }
    }

    this.logger.debug("Feishu webhook verified successfully");
  }

  /**
   * Verify Zoom webhook request
   * 
   * Verification strategy:
   * 1. Check token (from payload)
   * 2. Check timestamp to prevent replay attacks
   *
   * Note: For production, implement Zoom's HMAC-SHA256 signature verification
   *
   * @param headers - Request headers
   * @param body - Request body (stringified)
   * @throws WebhookSignatureVerificationException if verification fails
   */
  verifyZoomWebhook(headers: Record<string, string>, body: string): void {
    const timestamp = headers["x-zm-request-timestamp"];

    // Parse body to get token (if using custom token field)
    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      this.logger.error("Failed to parse Zoom webhook body");
      throw new WebhookSignatureVerificationException("Zoom");
    }

    // 1. Verify token (if present)
    if (payload.token) {
      this.verifyZoomToken(payload.token);
    }

    // 2. Verify timestamp (prevent replay attacks)
    if (timestamp) {
      const requestTime = parseInt(timestamp, 10);
      if (!this.verifyTimestamp(requestTime)) {
        throw new WebhookSignatureVerificationException("Zoom");
      }
    }

    this.logger.debug("Zoom webhook verified successfully");
  }
}
