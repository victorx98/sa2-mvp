import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { WebhookGatewayController } from "./controllers/webhook-gateway.controller";
import { WebhookVerificationService } from "./services/webhook-verification.service";
import { FeishuWebhookHandler } from "./handlers/feishu-webhook.handler";
import { ZoomWebhookHandler } from "./handlers/zoom-webhook.handler";
import { WebhookHandlerRegistry } from "./handlers/webhook-handler.registry";
import { SessionModule } from "@domains/services/session/session.module";

/**
 * Webhook Module
 *
 * Handles webhook events from meeting platforms (Feishu, Zoom)
 * Provides signature verification and event dispatching
 */
@Module({
  imports: [ConfigModule, SessionModule],
  controllers: [WebhookGatewayController],
  providers: [
    // Services
    WebhookVerificationService,

    // Handlers
    FeishuWebhookHandler,
    ZoomWebhookHandler,

    // Registry
    WebhookHandlerRegistry,
  ],
  exports: [
    // Export services that may be used by other modules
    WebhookVerificationService,
    WebhookHandlerRegistry,
  ],
})
export class WebhookModule {}
