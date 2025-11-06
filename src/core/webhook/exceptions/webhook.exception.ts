import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Base exception for Webhook errors
 */
export class WebhookException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(message, status);
  }
}

/**
 * Exception thrown when webhook signature verification fails
 */
export class WebhookSignatureVerificationException extends WebhookException {
  constructor(provider: string) {
    super(
      `Webhook signature verification failed for ${provider}`,
      HttpStatus.UNAUTHORIZED,
    );
  }
}

/**
 * Exception thrown when webhook event type is not supported
 */
export class WebhookEventNotSupportedException extends WebhookException {
  constructor(eventType: string) {
    super(
      `Webhook event type not supported: ${eventType}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Exception thrown when webhook processing fails
 */
export class WebhookProcessingException extends WebhookException {
  constructor(eventType: string, reason: string) {
    super(
      `Failed to process webhook event ${eventType}: ${reason}`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
