import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { WebhookGatewayController } from "./controllers/webhook-gateway.controller";
import { WebhookVerificationService } from "./services/webhook-verification.service";
import { WebhookEventBusService } from "./services/webhook-event-bus.service";
import { FeishuWebhookHandler } from "./handlers/feishu-webhook.handler";
import { ZoomWebhookHandler } from "./handlers/zoom-webhook.handler";
import { WebhookHandlerRegistry } from "./handlers/webhook-handler.registry";
import { FeishuEventExtractor } from "./extractors/feishu-event-extractor";
import { ZoomEventExtractor } from "./extractors/zoom-event-extractor";
import { MeetingProvidersModule } from "@core/meeting-providers/meeting-providers.module";

/**
 * Webhook Module
 *
 * Handles webhook events from meeting platforms (Feishu, Zoom)
 * Flow: Verify → Extract → Store → Publish domain events
 * Event-driven architecture for loose coupling with domain layers
 */
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    MeetingProvidersModule,
  ],
  controllers: [WebhookGatewayController],
  providers: [
    // Services
    WebhookVerificationService,
    WebhookEventBusService,

    // Event Extractors
    FeishuEventExtractor,
    ZoomEventExtractor,

    // Handlers
    FeishuWebhookHandler,
    ZoomWebhookHandler,

    // Registry
    WebhookHandlerRegistry,
  ],
  exports: [
    WebhookVerificationService,
    WebhookEventBusService,
    WebhookHandlerRegistry,
    FeishuEventExtractor,
    ZoomEventExtractor,
  ],
})
export class WebhookModule {}
