import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { WebhookGatewayController } from "./controllers/webhook-gateway.controller";
import { WebhookVerificationService } from "./services/webhook-verification.service";
import { FeishuWebhookHandler } from "./handlers/feishu-webhook.handler";
import { ZoomWebhookHandler } from "./handlers/zoom-webhook.handler";
import { FeishuEventExtractor } from "./extractors/feishu-event-extractor";
import { ZoomEventExtractor } from "./extractors/zoom-event-extractor";

/**
 * Webhook Module
 *
 * Pure infrastructure gateway for receiving webhook callbacks from third-party services.
 * 
 * Core Responsibilities:
 * 1. HTTP callback reception (Controller)
 * 2. Security verification - Token validation + Timestamp replay check (Verification Service)
 * 3. Protocol adaptation - Platform-specific to StandardEventDto (Handlers + Extractors)
 * 4. Event forwarding to subscribers via event bus
 * 
 * NOT Responsible For:
 * - Business event routing (Core Meeting Module handles this)
 * - Event publishing to domain subscribers (Event bus handles this)
 * - Domain-specific business logic
 * - Storage or persistence (handled by subscribers)
 * 
 * Design Principles:
 * - Minimal: Only handles HTTP gateway and protocol translation
 * - Decoupled: No dependencies on business modules
 * - Extensible: Easy to add new webhook providers
 * - Secure: Token verification + replay attack prevention
 */
@Module({
  imports: [ConfigModule],
  controllers: [WebhookGatewayController],
  providers: [
    // Security Services
    WebhookVerificationService,

    // Event Extractors
    FeishuEventExtractor,
    ZoomEventExtractor,

    // Platform Handlers
    FeishuWebhookHandler,
    ZoomWebhookHandler,
  ],
  exports: [
    WebhookVerificationService,
    FeishuEventExtractor,
    ZoomEventExtractor,
    FeishuWebhookHandler,
    ZoomWebhookHandler,
  ],
})
export class WebhookModule {}
