import { Test, TestingModule } from "@nestjs/testing";
import { HttpStatus } from "@nestjs/common";
import { WebhookGatewayController } from "./webhook-gateway.controller";
import { WebhookVerificationService } from "../services/webhook-verification.service";
import { FeishuWebhookHandler } from "../handlers/feishu-webhook.handler";
import { ZoomWebhookHandler } from "../handlers/zoom-webhook.handler";
import { WebhookSignatureVerificationException } from "../exceptions/webhook.exception";

describe("WebhookGatewayController", () => {
  let controller: WebhookGatewayController;
  let verificationService: jest.Mocked<WebhookVerificationService>;
  let feishuHandler: jest.Mocked<FeishuWebhookHandler>;
  let zoomHandler: jest.Mocked<ZoomWebhookHandler>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookGatewayController],
      providers: [
        {
          provide: WebhookVerificationService,
          useValue: {
            verifyFeishuToken: jest.fn(),
            verifyFeishuWebhook: jest.fn(),
            verifyZoomWebhook: jest.fn(),
          },
        },
        {
          provide: FeishuWebhookHandler,
          useValue: {
            handle: jest.fn(),
          },
        },
        {
          provide: ZoomWebhookHandler,
          useValue: {
            handle: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookGatewayController>(
      WebhookGatewayController,
    );
    verificationService = module.get(
      WebhookVerificationService,
    ) as jest.Mocked<WebhookVerificationService>;
    feishuHandler = module.get(FeishuWebhookHandler) as jest.Mocked<
      FeishuWebhookHandler
    >;
    zoomHandler = module.get(ZoomWebhookHandler) as jest.Mocked<
      ZoomWebhookHandler
    >;
  });

  describe("handleFeishuWebhook", () => {
    it("should handle URL verification challenge", async () => {
      const body = {
        type: "url_verification",
        challenge: "test_challenge_123",
        token: "test_token",
      };

      const result = await controller.handleFeishuWebhook(
        { rawBody: Buffer.from(JSON.stringify(body)) } as any,
        {},
        body as any,
      );

      expect(result).toEqual({ challenge: "test_challenge_123" });
      expect(verificationService.verifyFeishuToken).toHaveBeenCalledWith(
        "test_token",
      );
    });

    it("should verify and forward Feishu webhook event", async () => {
      const headers = {
        "x-lark-request-timestamp": "1234567890",
      };
      const body = {
        type: "event_callback",
        header: {
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "1234567890",
          event_id: "event_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_123",
            meeting_no: "123456789",
          },
        },
      };
      const rawBody = JSON.stringify(body);

      await controller.handleFeishuWebhook(
        { rawBody: Buffer.from(rawBody) } as any,
        headers,
        body as any,
      );

      expect(verificationService.verifyFeishuWebhook).toHaveBeenCalledWith(
        headers,
        rawBody,
      );
      expect(feishuHandler.handle).toHaveBeenCalledWith(body);
    });

    it("should return empty object after handling Feishu webhook", async () => {
      const headers = {
        "x-lark-request-timestamp": "1234567890",
      };
      const body = {
        type: "event_callback",
        header: {
          event_type: "vc.meeting.meeting_ended_v1",
          create_time: "1234567890",
          event_id: "event_123",
        },
        event: {
          type: "vc.meeting.meeting_ended_v1",
          meeting: {
            id: "meeting_123",
          },
        },
      };

      const result = await controller.handleFeishuWebhook(
        { rawBody: Buffer.from(JSON.stringify(body)) } as any,
        headers,
        body as any,
      );

      expect(result).toEqual({});
    });

    it("should throw when Feishu verification fails", async () => {
      const headers = {
        "x-lark-request-timestamp": "1234567890",
      };
      const body = {
        type: "event_callback",
        header: {
          event_type: "vc.meeting.meeting_ended_v1",
        },
      };

      verificationService.verifyFeishuWebhook.mockImplementation(() => {
        throw new WebhookSignatureVerificationException("Feishu");
      });

      await expect(
        controller.handleFeishuWebhook(
          { rawBody: Buffer.from(JSON.stringify(body)) } as any,
          headers,
          body as any,
        ),
      ).rejects.toThrow(WebhookSignatureVerificationException);
    });

    it("should handle Feishu meeting.started event", async () => {
      const headers = {
        "x-lark-request-timestamp": "1234567890",
      };
      const body = {
        type: "event_callback",
        header: {
          event_type: "vc.meeting.meeting_started_v1",
          create_time: "1234567890",
          event_id: "event_started",
        },
        event: {
          type: "vc.meeting.meeting_started_v1",
          meeting: {
            id: "meeting_started",
            meeting_no: "987654321",
          },
        },
      };

      await controller.handleFeishuWebhook(
        { rawBody: Buffer.from(JSON.stringify(body)) } as any,
        headers,
        body as any,
      );

      expect(feishuHandler.handle).toHaveBeenCalledWith(body);
    });

    it("should handle Feishu recording.ready event", async () => {
      const headers = {
        "x-lark-request-timestamp": "1234567890",
      };
      const body = {
        type: "event_callback",
        header: {
          event_type: "vc.meeting.recording_ready_v1",
          create_time: "1234567890",
          event_id: "event_recording",
        },
        event: {
          type: "vc.meeting.recording_ready_v1",
          meeting: {
            id: "meeting_recording",
            meeting_no: "555555555",
          },
          recording: {
            id: "recording_123",
            url: "https://example.com/recording",
          },
        },
      };

      await controller.handleFeishuWebhook(
        { rawBody: Buffer.from(JSON.stringify(body)) } as any,
        headers,
        body as any,
      );

      expect(feishuHandler.handle).toHaveBeenCalledWith(body);
    });

    it("should handle Feishu webhook with missing rawBody", async () => {
      const headers = {
        "x-lark-request-timestamp": "1234567890",
      };
      const body = {
        type: "event_callback",
        header: {
          event_type: "vc.meeting.meeting_ended_v1",
        },
      };

      await controller.handleFeishuWebhook(
        { rawBody: undefined } as any,
        headers,
        body as any,
      );

      expect(verificationService.verifyFeishuWebhook).toHaveBeenCalled();
    });

    it("should handle URL verification without token", async () => {
      const body = {
        type: "url_verification",
        challenge: "test_challenge",
      };

      const result = await controller.handleFeishuWebhook(
        { rawBody: Buffer.from(JSON.stringify(body)) } as any,
        {},
        body as any,
      );

      expect(result).toEqual({ challenge: "test_challenge" });
      expect(verificationService.verifyFeishuToken).not.toHaveBeenCalled();
    });

    it("should handle Feishu join.meeting event with operator", async () => {
      const headers = {
        "x-lark-request-timestamp": "1234567890",
      };
      const body = {
        type: "event_callback",
        header: {
          event_type: "vc.meeting.join_meeting_v1",
          create_time: "1234567890",
          event_id: "event_join",
        },
        event: {
          type: "vc.meeting.join_meeting_v1",
          meeting: {
            id: "meeting_join",
            meeting_no: "111111111",
          },
          operator: {
            id: {
              user_id: "user_join_123",
            },
            user_role: 2,
          },
        },
      };

      await controller.handleFeishuWebhook(
        { rawBody: Buffer.from(JSON.stringify(body)) } as any,
        headers,
        body as any,
      );

      expect(feishuHandler.handle).toHaveBeenCalledWith(body);
    });

    it("should handle Feishu leave.meeting event", async () => {
      const headers = {
        "x-lark-request-timestamp": "1234567890",
      };
      const body = {
        type: "event_callback",
        header: {
          event_type: "vc.meeting.leave_meeting_v1",
          create_time: "1234567890",
          event_id: "event_leave",
        },
        event: {
          type: "vc.meeting.leave_meeting_v1",
          meeting: {
            id: "meeting_leave",
            meeting_no: "222222222",
          },
          operator: {
            id: {
              user_id: "user_leave_456",
            },
          },
        },
      };

      await controller.handleFeishuWebhook(
        { rawBody: Buffer.from(JSON.stringify(body)) } as any,
        headers,
        body as any,
      );

      expect(feishuHandler.handle).toHaveBeenCalledWith(body);
    });
  });
});
