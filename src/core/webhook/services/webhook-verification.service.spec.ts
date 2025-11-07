import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { WebhookVerificationService } from "./webhook-verification.service";
import { WebhookSignatureVerificationException } from "../exceptions/webhook.exception";
import * as crypto from "crypto";

describe("WebhookVerificationService", () => {
  let service: WebhookVerificationService;
  const mockEncryptKey = "test-encrypt-key";
  const mockVerificationToken = "test-token";
  const mockZoomSecret = "test-zoom-secret";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookVerificationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case "FEISHU_ENCRYPT_KEY":
                  return mockEncryptKey;
                case "FEISHU_VERIFICATION_TOKEN":
                  return mockVerificationToken;
                case "ZOOM_WEBHOOK_SECRET_TOKEN":
                  return mockZoomSecret;
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookVerificationService>(
      WebhookVerificationService,
    );
  });

  describe("verifyFeishuSignature", () => {
    it("should return true for valid signature", () => {
      const timestamp = "1731247200";
      const nonce = "test-nonce";
      const body = '{"test":"data"}';

      // Calculate expected signature
      const content = timestamp + nonce + mockEncryptKey + body;
      const signature = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");

      const result = service.verifyFeishuSignature(
        timestamp,
        nonce,
        body,
        signature,
      );

      expect(result).toBe(true);
    });

    it("should return false for invalid signature", () => {
      const timestamp = "1731247200";
      const nonce = "test-nonce";
      const body = '{"test":"data"}';
      const invalidSignature = "invalid-signature";

      const result = service.verifyFeishuSignature(
        timestamp,
        nonce,
        body,
        invalidSignature,
      );

      expect(result).toBe(false);
    });
  });

  describe("verifyFeishuToken", () => {
    it("should return true for valid token", () => {
      const result = service.verifyFeishuToken(mockVerificationToken);
      expect(result).toBe(true);
    });

    it("should return false for invalid token", () => {
      const result = service.verifyFeishuToken("invalid-token");
      expect(result).toBe(false);
    });
  });

  describe("verifyZoomSignature", () => {
    it("should return true for valid signature", () => {
      const timestamp = "1731247200";
      const body = '{"test":"data"}';

      // Calculate expected signature
      const message = `v0:${timestamp}:${body}`;
      const hash = crypto
        .createHmac("sha256", mockZoomSecret)
        .update(message)
        .digest("hex");
      const signature = `v0=${hash}`;

      const result = service.verifyZoomSignature(timestamp, body, signature);

      expect(result).toBe(true);
    });

    it("should return false for invalid signature", () => {
      const timestamp = "1731247200";
      const body = '{"test":"data"}';
      const invalidSignature = "v0=invalid-signature";

      const result = service.verifyZoomSignature(
        timestamp,
        body,
        invalidSignature,
      );

      expect(result).toBe(false);
    });

    it("should return false for invalid signature format", () => {
      const timestamp = "1731247200";
      const body = '{"test":"data"}';
      const invalidSignature = "invalid-format";

      const result = service.verifyZoomSignature(
        timestamp,
        body,
        invalidSignature,
      );

      expect(result).toBe(false);
    });
  });

  describe("verifyFeishuWebhook", () => {
    it("should throw error if headers are missing", () => {
      const headers = {};
      const body = '{"test":"data"}';

      expect(() => {
        service.verifyFeishuWebhook(headers, body);
      }).toThrow(WebhookSignatureVerificationException);
    });

    it("should throw error if timestamp is too old", () => {
      const oldTimestamp = String(Math.floor(Date.now() / 1000) - 400); // 400 seconds ago
      const nonce = "test-nonce";
      const body = '{"test":"data"}';

      const content = oldTimestamp + nonce + mockEncryptKey + body;
      const signature = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");

      const headers = {
        "x-lark-request-timestamp": oldTimestamp,
        "x-lark-request-nonce": nonce,
        "x-lark-signature": signature,
      };

      expect(() => {
        service.verifyFeishuWebhook(headers, body);
      }).toThrow(WebhookSignatureVerificationException);
    });
  });
});
