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
