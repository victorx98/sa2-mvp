import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { FeishuMeetingClient } from "./feishu-meeting.client";
import {
  MeetingProviderAuthenticationException,
  MeetingProviderAPIException,
} from "../exceptions/meeting-provider.exception";
import axios from "axios";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("FeishuMeetingClient", () => {
  let client: FeishuMeetingClient;
  let configService: ConfigService;
  let mockAxiosInstance: any;

  beforeEach(async () => {
    // Setup mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      get: jest.fn(),
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeishuMeetingClient,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "FEISHU_APP_ID") return "test_app_id";
              if (key === "FEISHU_APP_SECRET") return "test_app_secret";
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    client = module.get<FeishuMeetingClient>(FeishuMeetingClient);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with correct configuration", () => {
      expect(configService.get).toHaveBeenCalledWith("FEISHU_APP_ID");
      expect(configService.get).toHaveBeenCalledWith("FEISHU_APP_SECRET");
    });

    it("should initialize even when configuration is missing", async () => {
      const mockConfigService = {
        get: jest.fn(() => ""),
      };

      const module = await Test.createTestingModule({
        providers: [
          FeishuMeetingClient,
          {
            provide: ConfigService,
            useValue: mockConfigService,
          },
        ],
      }).compile();

      const testClient = module.get<FeishuMeetingClient>(FeishuMeetingClient);

      // Verify client was created and config was read
      expect(testClient).toBeDefined();
      expect(mockConfigService.get).toHaveBeenCalled();
    });
  });

  describe("applyReservation", () => {
    it("should create a reservation successfully", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      const mockReservationResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            reserve: {
              id: "reserve_123",
              meeting_no: "123456789",
              url: "https://vc.feishu.cn/j/123456789",
              live_link: "",
              end_time: "1731250800",
            },
          },
        },
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockReservationResponse);

      const payload = {
        end_time: "1731250800",
        meeting_settings: {
          topic: "Test Meeting",
          auto_record: true,
          open_lobby: false,
          allow_attendees_start: true,
        },
      };

      const result = await client.applyReservation(payload);

      expect(result).toEqual({
        reserve: {
          id: "reserve_123",
          meeting_no: "123456789",
          url: "https://vc.feishu.cn/j/123456789",
          live_link: "",
          end_time: "1731250800",
        },
      });

      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        2,
        "/vc/v1/reserves/apply",
        payload,
        {
          headers: {
            Authorization: "Bearer mock_token",
          },
        },
      );
    });

    it("should throw MeetingProviderAPIException when API returns error code", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      const mockErrorResponse = {
        data: {
          code: 99991663,
          msg: "Invalid parameter",
        },
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockErrorResponse);

      const payload = {
        end_time: "1731250800",
        meeting_settings: {
          topic: "Test Meeting",
        },
      };

      await expect(client.applyReservation(payload)).rejects.toThrow(
        MeetingProviderAPIException,
      );
    });

    it("should throw MeetingProviderAPIException when no data returned", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      const mockEmptyResponse = {
        data: {
          code: 0,
          msg: "success",
        },
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockEmptyResponse);

      const payload = {
        end_time: "1731250800",
      };

      await expect(client.applyReservation(payload)).rejects.toThrow(
        MeetingProviderAPIException,
      );
    });

    it("should handle network errors", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce(mockTokenResponse)
        .mockRejectedValueOnce(new Error("Network error"));

      const payload = {
        end_time: "1731250800",
      };

      await expect(client.applyReservation(payload)).rejects.toThrow(
        MeetingProviderAPIException,
      );
    });
  });

  describe("updateReservation", () => {
    it("should update a reservation successfully", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      const mockUpdateResponse = {
        data: {
          code: 0,
          msg: "success",
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);
      mockAxiosInstance.put.mockResolvedValueOnce(mockUpdateResponse);

      const reserveId = "reserve_123";
      const payload = {
        meeting_settings: {
          topic: "Updated Topic",
        },
      };

      await client.updateReservation(reserveId, payload);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        `/vc/v1/reserves/${reserveId}`,
        payload,
        {
          headers: {
            Authorization: "Bearer mock_token",
          },
        },
      );
    });

    it("should throw MeetingProviderAPIException when update fails", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      const mockErrorResponse = {
        data: {
          code: 99991663,
          msg: "Reserve not found",
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);
      mockAxiosInstance.put.mockResolvedValueOnce(mockErrorResponse);

      await expect(client.updateReservation("reserve_123", {})).rejects.toThrow(
        MeetingProviderAPIException,
      );
    });
  });

  describe("deleteReservation", () => {
    it("should delete a reservation successfully", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      const mockDeleteResponse = {
        data: {
          code: 0,
          msg: "success",
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);
      mockAxiosInstance.delete.mockResolvedValueOnce(mockDeleteResponse);

      const reserveId = "reserve_123";

      await client.deleteReservation(reserveId);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        `/vc/v1/reserves/${reserveId}`,
        {
          headers: {
            Authorization: "Bearer mock_token",
          },
        },
      );
    });

    it("should throw MeetingProviderAPIException when delete fails", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);
      mockAxiosInstance.delete.mockRejectedValueOnce(
        new Error("Delete failed"),
      );

      await expect(client.deleteReservation("reserve_123")).rejects.toThrow(
        MeetingProviderAPIException,
      );
    });
  });

  describe("getReservationInfo", () => {
    it("should get reservation info successfully", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      const mockInfoResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            reserve: {
              id: "reserve_123",
              meeting_no: "123456789",
              url: "https://vc.feishu.cn/j/123456789",
              live_link: "",
              end_time: "1731250800",
              topic: "Test Meeting",
              meeting_start_time: "2025-11-10T14:00:00Z",
              meeting_duration: 60,
              owner: {
                id: "ou_xxx",
                user_type: 1,
              },
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);
      mockAxiosInstance.get.mockResolvedValueOnce(mockInfoResponse);

      const reserveId = "reserve_123";
      const result = await client.getReservationInfo(reserveId);

      expect(result).toEqual({
        reserve: {
          id: "reserve_123",
          meeting_no: "123456789",
          url: "https://vc.feishu.cn/j/123456789",
          live_link: "",
          end_time: "1731250800",
          topic: "Test Meeting",
          meeting_start_time: "2025-11-10T14:00:00Z",
          meeting_duration: 60,
          owner: {
            id: "ou_xxx",
            user_type: 1,
          },
        },
      });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        `/vc/v1/reserves/${reserveId}`,
        {
          headers: {
            Authorization: "Bearer mock_token",
          },
        },
      );
    });

    it("should throw MeetingProviderAPIException when no data returned", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      const mockEmptyResponse = {
        data: {
          code: 0,
          msg: "success",
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockTokenResponse);
      mockAxiosInstance.get.mockResolvedValueOnce(mockEmptyResponse);

      await expect(client.getReservationInfo("reserve_123")).rejects.toThrow(
        MeetingProviderAPIException,
      );
    });
  });

  describe("getTenantAccessToken", () => {
    it("should cache token and reuse it", async () => {
      const mockTokenResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            tenant_access_token: "mock_token",
            expire: 7200,
          },
        },
      };

      const mockReservationResponse = {
        data: {
          code: 0,
          msg: "success",
          data: {
            reserve: {
              id: "reserve_123",
              meeting_no: "123456789",
              url: "https://vc.feishu.cn/j/123456789",
              live_link: "",
              end_time: "1731250800",
            },
          },
        },
      };

      mockAxiosInstance.post
        .mockResolvedValueOnce(mockTokenResponse)
        .mockResolvedValueOnce(mockReservationResponse)
        .mockResolvedValueOnce(mockReservationResponse);

      // First call - should fetch token
      await client.applyReservation({
        end_time: "1731250800",
      });

      // Second call - should reuse cached token
      await client.applyReservation({
        end_time: "1731250800",
      });

      // Token endpoint should only be called once
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3);
      expect(mockAxiosInstance.post).toHaveBeenNthCalledWith(
        1,
        "/auth/v3/tenant_access_token/internal",
        {
          app_id: "test_app_id",
          app_secret: "test_app_secret",
        },
      );
    });

    it("should throw MeetingProviderAuthenticationException when token fetch fails", async () => {
      const mockErrorResponse = {
        data: {
          code: 99991663,
          msg: "Invalid app_id or app_secret",
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockErrorResponse);

      await expect(
        client.applyReservation({
          end_time: "1731250800",
        }),
      ).rejects.toThrow(MeetingProviderAuthenticationException);
    });

    it("should throw MeetingProviderAuthenticationException when token data is missing", async () => {
      const mockEmptyResponse = {
        data: {
          code: 0,
          msg: "success",
        },
      };

      mockAxiosInstance.post.mockResolvedValueOnce(mockEmptyResponse);

      await expect(
        client.applyReservation({
          end_time: "1731250800",
        }),
      ).rejects.toThrow(MeetingProviderAuthenticationException);
    });
  });
});
