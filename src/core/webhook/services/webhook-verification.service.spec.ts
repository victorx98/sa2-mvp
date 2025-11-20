import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { WebhookVerificationService } from "./webhook-verification.service";
import { WebhookSignatureVerificationException } from "../exceptions/webhook.exception";

describe("WebhookVerificationService", () => {
  let service: WebhookVerificationService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case "FEISHU_VERIFICATION_TOKEN":
            return "feishu_token_123";
          case "ZOOM_VERIFICATION_TOKEN":
            return "zoom_token_456";
          default:
            return null;
        }
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookVerificationService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<WebhookVerificationService>(
      WebhookVerificationService,
    );
  });

  describe("verifyFeishuToken", () => {
    it("should verify valid Feishu token", () => {
      expect(() => service.verifyFeishuToken("feishu_token_123")).not.toThrow();
    });

    it("should throw on invalid Feishu token", () => {
      expect(() => service.verifyFeishuToken("invalid_token")).toThrow(
        WebhookSignatureVerificationException,
      );
    });

    it("should skip verification if token not configured", () => {
      configService.get.mockReturnValue(null);
      const newService = new WebhookVerificationService(configService);

      expect(() => newService.verifyFeishuToken("any_token")).not.toThrow();
    });
  });

  describe("verifyZoomToken", () => {
    it("should verify valid Zoom token", () => {
      expect(() => service.verifyZoomToken("zoom_token_456")).not.toThrow();
    });

    it("should throw on invalid Zoom token", () => {
      expect(() => service.verifyZoomToken("invalid_token")).toThrow(
        WebhookSignatureVerificationException,
      );
    });

    it("should skip verification if Zoom token not configured", () => {
      configService.get.mockReturnValue(null);
      const newService = new WebhookVerificationService(configService);

      expect(() => newService.verifyZoomToken("any_token")).not.toThrow();
    });
  });

  describe("verifyFeishuWebhook", () => {
    it("should verify valid Feishu webhook with token", () => {
      const headers = {
        "x-lark-request-timestamp": Math.floor(Date.now() / 1000).toString(),
      };
      const body = JSON.stringify({
        token: "feishu_token_123",
        header: {
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: Date.now().toString(),
        },
      });

      expect(() =>
        service.verifyFeishuWebhook(headers, body),
      ).not.toThrow();
    });

    it("should throw on invalid Feishu token in webhook", () => {
      const headers = {
        "x-lark-request-timestamp": Math.floor(Date.now() / 1000).toString(),
      };
      const body = JSON.stringify({
        token: "invalid_token",
      });

      expect(() =>
        service.verifyFeishuWebhook(headers, body),
      ).toThrow(WebhookSignatureVerificationException);
    });

    it("should throw on old timestamp (replay attack prevention)", () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago
      const headers = {
        "x-lark-request-timestamp": oldTimestamp,
      };
      const body = JSON.stringify({
        token: "feishu_token_123",
      });

      expect(() =>
        service.verifyFeishuWebhook(headers, body),
      ).toThrow(WebhookSignatureVerificationException);
    });

    it("should accept recent timestamp within 5-minute window", () => {
      const recentTimestamp = (
        Math.floor(Date.now() / 1000) - 100
      ).toString(); // 100 seconds ago
      const headers = {
        "x-lark-request-timestamp": recentTimestamp,
      };
      const body = JSON.stringify({
        token: "feishu_token_123",
      });

      expect(() =>
        service.verifyFeishuWebhook(headers, body),
      ).not.toThrow();
    });

    it("should handle missing token in payload", () => {
      const headers = {
        "x-lark-request-timestamp": Math.floor(Date.now() / 1000).toString(),
      };
      const body = JSON.stringify({
        header: {
          event_type: "vc.meeting.meeting_ended_v1",
        },
      });

      expect(() =>
        service.verifyFeishuWebhook(headers, body),
      ).not.toThrow();
    });

    it("should throw on invalid JSON in body", () => {
      const headers = {
        "x-lark-request-timestamp": Math.floor(Date.now() / 1000).toString(),
      };
      const body = "invalid json";

      expect(() =>
        service.verifyFeishuWebhook(headers, body),
      ).toThrow(WebhookSignatureVerificationException);
    });
  });

  describe("verifyZoomWebhook", () => {
    it("should verify valid Zoom webhook with token", () => {
      const headers = {
        "x-zm-request-timestamp": Math.floor(Date.now() / 1000).toString(),
      };
      const body = JSON.stringify({
        token: "zoom_token_456",
        event: "meeting.ended",
      });

      expect(() => service.verifyZoomWebhook(headers, body)).not.toThrow();
    });

    it("should throw on invalid Zoom token in webhook", () => {
      const headers = {
        "x-zm-request-timestamp": Math.floor(Date.now() / 1000).toString(),
      };
      const body = JSON.stringify({
        token: "invalid_token",
        event: "meeting.ended",
      });

      expect(() => service.verifyZoomWebhook(headers, body)).toThrow(
        WebhookSignatureVerificationException,
      );
    });

    it("should throw on old Zoom webhook timestamp", () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString();
      const headers = {
        "x-zm-request-timestamp": oldTimestamp,
      };
      const body = JSON.stringify({
        token: "zoom_token_456",
      });

      expect(() => service.verifyZoomWebhook(headers, body)).toThrow(
        WebhookSignatureVerificationException,
      );
    });

    it("should handle missing token in Zoom payload", () => {
      const headers = {
        "x-zm-request-timestamp": Math.floor(Date.now() / 1000).toString(),
      };
      const body = JSON.stringify({
        event: "meeting.started",
      });

      expect(() => service.verifyZoomWebhook(headers, body)).not.toThrow();
    });

    it("should throw on invalid JSON in Zoom body", () => {
      const headers = {
        "x-zm-request-timestamp": Math.floor(Date.now() / 1000).toString(),
      };
      const body = "invalid json";

      expect(() => service.verifyZoomWebhook(headers, body)).toThrow(
        WebhookSignatureVerificationException,
      );
    });
  });

  describe("Timestamp verification edge cases", () => {
    it("should accept timestamp exactly at 5-minute boundary", () => {
      const boundaryTimestamp = (
        Math.floor(Date.now() / 1000) - 300
      ).toString();
      const headers = {
        "x-lark-request-timestamp": boundaryTimestamp,
      };
      const body = JSON.stringify({
        token: "feishu_token_123",
      });

      expect(() =>
        service.verifyFeishuWebhook(headers, body),
      ).not.toThrow();
    });

    it("should reject timestamp just beyond 5-minute boundary", () => {
      const beyondBoundaryTimestamp = (
        Math.floor(Date.now() / 1000) - 301
      ).toString();
      const headers = {
        "x-lark-request-timestamp": beyondBoundaryTimestamp,
      };
      const body = JSON.stringify({
        token: "feishu_token_123",
      });

      expect(() =>
        service.verifyFeishuWebhook(headers, body),
      ).toThrow(WebhookSignatureVerificationException);
    });

    it("should handle future timestamps (small clock skew)", () => {
      const futureTimestamp = (
        Math.floor(Date.now() / 1000) + 30
      ).toString();
      const headers = {
        "x-lark-request-timestamp": futureTimestamp,
      };
      const body = JSON.stringify({
        token: "feishu_token_123",
      });

      expect(() =>
        service.verifyFeishuWebhook(headers, body),
      ).not.toThrow();
    });
  });
});

