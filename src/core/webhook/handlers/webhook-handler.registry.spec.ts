import { Test, TestingModule } from "@nestjs/testing";
import { WebhookHandlerRegistry } from "./webhook-handler.registry";
import { FeishuWebhookHandler } from "./feishu-webhook.handler";
import { ZoomWebhookHandler } from "./zoom-webhook.handler";
import { IWebhookEvent } from "../interfaces/webhook-handler.interface";
import { WebhookEventNotSupportedException } from "../exceptions/webhook.exception";

describe("WebhookHandlerRegistry", () => {
  let registry: WebhookHandlerRegistry;
  let feishuHandler: FeishuWebhookHandler;
  let zoomHandler: ZoomWebhookHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookHandlerRegistry,
        {
          provide: FeishuWebhookHandler,
          useValue: {
            getSupportedEventTypes: jest
              .fn()
              .mockReturnValue(["vc.meeting.meeting_started_v1"]),
            handleEvent: jest.fn(),
          },
        },
        {
          provide: ZoomWebhookHandler,
          useValue: {
            getSupportedEventTypes: jest
              .fn()
              .mockReturnValue(["meeting.started"]),
            handleEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    registry = module.get<WebhookHandlerRegistry>(WebhookHandlerRegistry);
    feishuHandler = module.get<FeishuWebhookHandler>(FeishuWebhookHandler);
    zoomHandler = module.get<ZoomWebhookHandler>(ZoomWebhookHandler);
  });

  describe("dispatchEvent", () => {
    it("should dispatch event to Feishu handler", async () => {
      const event: IWebhookEvent = {
        eventType: "vc.meeting.meeting_started_v1",
        eventData: {},
        timestamp: Date.now(),
      };

      await registry.dispatchEvent(event);

      expect(feishuHandler.handleEvent).toHaveBeenCalledWith(event);
    });

    it("should dispatch event to Zoom handler", async () => {
      const event: IWebhookEvent = {
        eventType: "meeting.started",
        eventData: {},
        timestamp: Date.now(),
      };

      await registry.dispatchEvent(event);

      expect(zoomHandler.handleEvent).toHaveBeenCalledWith(event);
    });

    it("should throw error for unsupported event type", async () => {
      const event: IWebhookEvent = {
        eventType: "unsupported.event",
        eventData: {},
        timestamp: Date.now(),
      };

      await expect(registry.dispatchEvent(event)).rejects.toThrow(
        WebhookEventNotSupportedException,
      );
    });
  });

  describe("getSupportedEventTypes", () => {
    it("should return all supported event types", () => {
      const types = registry.getSupportedEventTypes();

      expect(types).toContain("vc.meeting.meeting_started_v1");
      expect(types).toContain("meeting.started");
    });
  });
});
