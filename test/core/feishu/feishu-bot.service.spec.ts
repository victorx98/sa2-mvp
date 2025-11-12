import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { FeishuBotService } from "@core/feishu/bot/services/feishu-bot.service";
import { IFeishuCard } from "@core/feishu/bot/interfaces/feishu-bot.interface";
import axios from "axios";
import { ISessionEntity } from "@domains/services/session/interfaces/session.interface";
import { SessionStatus } from "@domains/services/session/interfaces/session.interface";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("FeishuBotService Unit Tests", () => {
  let service: FeishuBotService;
  let configService: ConfigService;
  let mockAxiosInstance: {
    post: jest.Mock;
  };

  beforeEach(async () => {
    // Create mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
    };

    // Mock axios.create to return our mock instance
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              FEISHU_BOT_APP_ID: "test-app-id",
              FEISHU_BOT_APP_SECRET: "test-app-secret",
            }),
          ],
        }),
      ],
      providers: [FeishuBotService],
    }).compile();

    service = module.get<FeishuBotService>(FeishuBotService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("sendCard", () => {
    it("should send card message successfully", async () => {
      // Arrange
      const userId = "ou_test_user_id";
      const card: IFeishuCard = {
        config: {
          wide_screen_mode: true,
          enable_forward: true,
        },
        header: {
          title: {
            tag: "plain_text" as const,
            content: "Test Card",
          },
          template: "blue" as const,
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: "Test content",
            },
          },
        ],
      };

      // Mock tenant access token response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 0,
          tenant_access_token: "test-token-123",
          expire: 7200,
        },
      });

      // Mock send message response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 0,
          msg: "success",
          data: {
            message_id: "om_test_message_id",
          },
        },
      });

      // Act
      await service.sendCard(userId, card);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      // First call: get tenant access token
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        1,
        "/auth/v3/tenant_access_token/internal",
        {
          app_id: "test-app-id",
          app_secret: "test-app-secret",
        },
      );
      // Second call: send message
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        2,
        "/im/v1/messages",
        {
          receive_id: userId,
          msg_type: "interactive",
          content: JSON.stringify({ card }),
        },
        expect.objectContaining({
          headers: {
            Authorization: "Bearer test-token-123",
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("should use cached token for subsequent requests", async () => {
      // Arrange
      const userId = "ou_test_user_id";
      const card = {
        elements: [],
      };

      // Mock tenant access token response (only once)
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 0,
          tenant_access_token: "cached-token",
          expire: 7200,
        },
      });

      // Mock send message responses (twice)
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { code: 0 },
        })
        .mockResolvedValueOnce({
          data: { code: 0 },
        });

      // Act - Send card twice
      await service.sendCard(userId, card);
      await service.sendCard(userId, card);

      // Assert - Should call token API only once
      const tokenCalls = mockAxiosInstance.post.mock.calls.filter(
        (call) => call[0] === "/auth/v3/tenant_access_token/internal",
      );
      expect(tokenCalls).toHaveLength(1);
    });

    it("should throw error when Feishu API returns error code", async () => {
      // Arrange
      const userId = "ou_test_user_id";
      const card = {
        elements: [],
      };

      // Mock tenant access token response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 0,
          tenant_access_token: "test-token",
          expire: 7200,
        },
      });

      // Mock send message error response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 99991663,
          msg: "user not found",
        },
      });

      // Act & Assert
      await expect(service.sendCard(userId, card)).rejects.toThrow(
        "Feishu API error: user not found",
      );
    });

    it("should throw error when credentials not configured", async () => {
      // Arrange - Create service without credentials
      const module: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [
              () => ({
                FEISHU_BOT_APP_ID: undefined,
                FEISHU_BOT_APP_SECRET: undefined,
              }),
            ],
          }),
        ],
        providers: [FeishuBotService],
      }).compile();

      const serviceWithoutCreds =
        module.get<FeishuBotService>(FeishuBotService);

      const userId = "ou_test_user_id";
      const card = {
        elements: [],
      };

      // Act & Assert
      await expect(serviceWithoutCreds.sendCard(userId, card)).rejects.toThrow(
        "Feishu Bot credentials not configured",
      );
    });
  });

  describe("sendTextMessage", () => {
    it("should send text message successfully", async () => {
      // Arrange
      const userId = "ou_test_user_id";
      const text = "Hello, this is a test message";

      // Mock tenant access token response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 0,
          tenant_access_token: "test-token-456",
          expire: 7200,
        },
      });

      // Mock send message response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 0,
          msg: "success",
        },
      });

      // Act
      await service.sendTextMessage(userId, text);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        2,
        "/im/v1/messages",
        {
          receive_id: userId,
          msg_type: "text",
          content: JSON.stringify({ text }),
        },
        expect.objectContaining({
          headers: {
            Authorization: "Bearer test-token-456",
            "Content-Type": "application/json",
          },
        }),
      );
    });

    it("should throw error when sending fails", async () => {
      // Arrange
      const userId = "ou_test_user_id";
      const text = "Test message";

      // Mock tenant access token response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 0,
          tenant_access_token: "test-token",
          expire: 7200,
        },
      });

      // Mock network error
      const error = new Error("Network error");
      mockAxiosInstance.post.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(service.sendTextMessage(userId, text)).rejects.toThrow(
        error,
      );
    });
  });

  describe("sendSessionSummaryCard", () => {
    it("should send session summary card successfully", async () => {
      // Arrange
      const session: ISessionEntity = {
        id: "session-123",
        studentId: "student-123",
        mentorId: "mentor-123",
        contractId: "contract-123",
        meetingProvider: "feishu",
        meetingNo: "123456789",
        meetingUrl: "https://vc.feishu.cn/j/123456789",
        meetingPassword: null,
        scheduledStartTime: new Date("2025-11-10T14:00:00Z"),
        scheduledDuration: 60,
        actualStartTime: new Date("2025-11-10T14:02:00Z"),
        actualEndTime: new Date("2025-11-10T15:00:00Z"),
        recordings: [
          {
            recordingId: "rec-123",
            recordingUrl: "https://feishu.cn/minutes/rec-123",
            transcriptUrl: null,
            duration: 3480,
            sequence: 1,
            startedAt: new Date("2025-11-10T14:02:00Z"),
            endedAt: new Date("2025-11-10T15:00:00Z"),
          },
        ],
        aiSummary: null,
        mentorTotalDurationSeconds: 3480,
        studentTotalDurationSeconds: 3480,
        effectiveTutoringDurationSeconds: 3480,
        mentorJoinCount: 1,
        studentJoinCount: 1,
        sessionName: "System Design Interview",
        notes: "Discussed distributed systems",
        status: SessionStatus.COMPLETED,
        createdAt: new Date("2025-11-05T10:00:00Z"),
        updatedAt: new Date("2025-11-10T15:00:00Z"),
        deletedAt: null,
      };

      const userId = "ou_test_user_id";

      // Mock tenant access token response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 0,
          tenant_access_token: "test-token-789",
          expire: 7200,
        },
      });

      // Mock send message response
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 0,
          msg: "success",
        },
      });

      // Act
      await service.sendSessionSummaryCard(session, userId);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      const sendMessageCall = mockAxiosInstance.post.mock.calls[1];
      const messageContent = JSON.parse(sendMessageCall[1].content);
      const card = messageContent.card;

      expect(card.header.title.content).toBe("约课总结");
      expect(card.elements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            text: expect.objectContaining({
              content: expect.stringContaining(session.sessionName),
            }),
          }),
        ]),
      );
    });

    it("should include recording link in summary card when available", async () => {
      // Arrange
      const session: ISessionEntity = {
        id: "session-456",
        studentId: "student-456",
        mentorId: "mentor-456",
        contractId: "contract-456",
        meetingProvider: "feishu",
        meetingNo: null,
        meetingUrl: "https://vc.feishu.cn/j/456",
        meetingPassword: null,
        scheduledStartTime: new Date(),
        scheduledDuration: 60,
        actualStartTime: new Date(),
        actualEndTime: new Date(),
        recordings: [
          {
            recordingId: "rec-456",
            recordingUrl: "https://feishu.cn/minutes/rec-456",
            transcriptUrl: null,
            duration: 3600,
            sequence: 1,
            startedAt: new Date(),
            endedAt: new Date(),
          },
        ],
        aiSummary: null,
        mentorTotalDurationSeconds: 3600,
        studentTotalDurationSeconds: 3600,
        effectiveTutoringDurationSeconds: 3600,
        mentorJoinCount: 1,
        studentJoinCount: 1,
        sessionName: "Mock Interview",
        notes: null,
        status: SessionStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const userId = "ou_test_user_id";

      // Mock responses
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          code: 0,
          tenant_access_token: "test-token",
          expire: 7200,
        },
      });

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { code: 0 },
      });

      // Act
      await service.sendSessionSummaryCard(session, userId);

      // Assert
      const sendMessageCall = mockAxiosInstance.post.mock.calls[1];
      const messageContent = JSON.parse(sendMessageCall[1].content);
      const card = messageContent.card;

      // Check for action element with recording URL
      const actionElement = card.elements.find(
        (el: { tag: string }) => el.tag === "action",
      );
      expect(actionElement).toBeDefined();
      expect(actionElement.actions[0].url).toBe(
        session.recordings[0].recordingUrl,
      );
    });
  });
});
