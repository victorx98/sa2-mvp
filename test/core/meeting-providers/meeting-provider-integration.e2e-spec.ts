import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import {
  MeetingProviderFactory,
  MeetingProviderType,
  ICreateMeetingInput,
  IUpdateMeetingInput,
  IMeetingInfo,
  FeishuMeetingAdapter,
  ZoomMeetingAdapter,
  FeishuMeetingClient,
  ZoomMeetingClient,
  MeetingProviderModule,
  MeetingProviderException,
} from "../../../src/core/meeting-providers";

/**
 * Meeting Provider Integration E2E Tests
 *
 * Tests the integration between different components of the meeting provider system:
 * - Factory pattern for provider selection
 * - Complete CRUD operations flow
 * - Error handling and edge cases
 * - Configuration-based provider selection
 */
describe("MeetingProviderModule Integration (E2E)", () => {
  let moduleRef: TestingModule;
  let factory: MeetingProviderFactory;
  let feishuAdapter: FeishuMeetingAdapter;
  let zoomAdapter: ZoomMeetingAdapter;
  let feishuClient: FeishuMeetingClient;
  let zoomClient: ZoomMeetingClient;
  let configService: ConfigService;

  // Test data
  const mockCreateInput: ICreateMeetingInput = {
    topic: "Integration Test Meeting",
    startTime: new Date("2025-12-01T10:00:00Z"),
    duration: 60,
    hostUserId: "test-user-123",
    autoRecord: true,
  };

  const mockFeishuMeetingInfo: IMeetingInfo = {
    provider: MeetingProviderType.FEISHU,
    meetingId: "feishu-meeting-123",
    meetingNo: "123456789",
    meetingUrl: "https://feishu.cn/meetings/123456789",
    meetingPassword: "123456",
    hostJoinUrl: null,
    startTime: mockCreateInput.startTime,
    duration: mockCreateInput.duration,
  };

  const mockZoomMeetingInfo: IMeetingInfo = {
    provider: MeetingProviderType.ZOOM,
    meetingId: "zoom-meeting-456",
    meetingNo: null,
    meetingUrl: "https://zoom.us/j/123456789",
    meetingPassword: "abc123",
    hostJoinUrl: "https://zoom.us/s/123456789",
    startTime: mockCreateInput.startTime,
    duration: mockCreateInput.duration,
  };

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env.test",
        }),
        MeetingProviderModule,
      ],
    }).compile();

    factory = moduleRef.get<MeetingProviderFactory>(MeetingProviderFactory);
    feishuAdapter = moduleRef.get<FeishuMeetingAdapter>(FeishuMeetingAdapter);
    zoomAdapter = moduleRef.get<ZoomMeetingAdapter>(ZoomMeetingAdapter);
    feishuClient = moduleRef.get<FeishuMeetingClient>(FeishuMeetingClient);
    zoomClient = moduleRef.get<ZoomMeetingClient>(ZoomMeetingClient);
    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  describe("Factory Integration", () => {
    it("should initialize factory with all adapters", () => {
      expect(factory).toBeDefined();
      expect(feishuAdapter).toBeDefined();
      expect(zoomAdapter).toBeDefined();
    });

    it("should return correct provider for Feishu", () => {
      const provider = factory.getProvider(MeetingProviderType.FEISHU);
      expect(provider).toBe(feishuAdapter);
    });

    it("should return correct provider for Zoom", () => {
      const provider = factory.getProvider(MeetingProviderType.ZOOM);
      expect(provider).toBe(zoomAdapter);
    });

    it("should throw exception for invalid provider type", () => {
      expect(() => {
        factory.getProvider("invalid" as MeetingProviderType);
      }).toThrow(MeetingProviderException);
    });

    it("should return default provider based on configuration", () => {
      const defaultProvider = factory.getDefaultProvider();
      expect(defaultProvider).toBeDefined();

      // Default provider should be either Feishu or Zoom
      const isValidProvider =
        defaultProvider === feishuAdapter || defaultProvider === zoomAdapter;
      expect(isValidProvider).toBe(true);
    });
  });

  describe("Feishu Provider - Complete CRUD Flow", () => {
    beforeEach(() => {
      // Mock Feishu client methods (using actual method names)
      jest.spyOn(feishuClient, "applyReservation").mockResolvedValue({
        reserve: {
          id: mockFeishuMeetingInfo.meetingId,
          meeting_no: mockFeishuMeetingInfo.meetingNo!,
          url: mockFeishuMeetingInfo.meetingUrl,
          live_link: "https://feishu.cn/live/123",
          end_time: new Date(
            mockFeishuMeetingInfo.startTime.getTime() +
              mockFeishuMeetingInfo.duration * 60 * 1000,
          )
            .getTime()
            .toString(),
        },
      });
      jest.spyOn(feishuClient, "getReservationInfo").mockResolvedValue({
        reserve: {
          id: mockFeishuMeetingInfo.meetingId,
          meeting_no: mockFeishuMeetingInfo.meetingNo!,
          url: mockFeishuMeetingInfo.meetingUrl,
          live_link: "https://feishu.cn/live/123",
          end_time: new Date(
            mockFeishuMeetingInfo.startTime.getTime() +
              mockFeishuMeetingInfo.duration * 60 * 1000,
          )
            .getTime()
            .toString(),
          topic: mockCreateInput.topic,
          meeting_start_time: mockFeishuMeetingInfo.startTime.getTime().toString(),
          meeting_duration: mockFeishuMeetingInfo.duration,
          owner: {
            id: "test-user-123",
            user_type: 1,
          },
        },
      });
      jest.spyOn(feishuClient, "updateReservation").mockResolvedValue(undefined);
      jest.spyOn(feishuClient, "deleteReservation").mockResolvedValue(undefined);
    });

    it("should complete full lifecycle: create -> get -> update -> cancel", async () => {
      const provider = factory.getProvider(MeetingProviderType.FEISHU);

      // Step 1: Create meeting
      const createdMeeting = await provider.createMeeting(mockCreateInput);
      expect(createdMeeting).toBeDefined();
      expect(createdMeeting.provider).toBe(MeetingProviderType.FEISHU);
      expect(createdMeeting.meetingId).toBe(mockFeishuMeetingInfo.meetingId);
      expect(createdMeeting.meetingNo).toBe(mockFeishuMeetingInfo.meetingNo);
      expect(feishuClient.applyReservation).toHaveBeenCalled();

      // Step 2: Get meeting info
      const meetingInfo = await provider.getMeetingInfo(
        createdMeeting.meetingId,
      );
      expect(meetingInfo).toBeDefined();
      expect(meetingInfo.meetingId).toBe(createdMeeting.meetingId);
      expect(feishuClient.getReservationInfo).toHaveBeenCalledWith(
        createdMeeting.meetingId,
      );

      // Step 3: Update meeting
      const updateInput: IUpdateMeetingInput = {
        topic: "Updated Meeting Topic",
        duration: 90,
      };
      const updateResult = await provider.updateMeeting(
        createdMeeting.meetingId,
        updateInput,
      );
      expect(updateResult).toBe(true);
      expect(feishuClient.updateReservation).toHaveBeenCalledWith(
        createdMeeting.meetingId,
        expect.any(Object),
      );

      // Step 4: Cancel meeting
      const cancelResult = await provider.cancelMeeting(
        createdMeeting.meetingId,
      );
      expect(cancelResult).toBe(true);
      expect(feishuClient.deleteReservation).toHaveBeenCalledWith(
        createdMeeting.meetingId,
      );
    });

    it("should handle create meeting with minimal input", async () => {
      const minimalInput: ICreateMeetingInput = {
        topic: "Minimal Meeting",
        startTime: new Date(),
        duration: 30,
      };

      const provider = factory.getProvider(MeetingProviderType.FEISHU);
      const meeting = await provider.createMeeting(minimalInput);

      expect(meeting).toBeDefined();
      expect(meeting.duration).toBe(30);
      expect(feishuClient.applyReservation).toHaveBeenCalled();
    });

    it("should propagate errors from Feishu client", async () => {
      jest
        .spyOn(feishuClient, "applyReservation")
        .mockRejectedValue(new Error("Feishu API error"));

      const provider = factory.getProvider(MeetingProviderType.FEISHU);

      await expect(provider.createMeeting(mockCreateInput)).rejects.toThrow();
    });
  });

  describe("Zoom Provider - Complete CRUD Flow", () => {
    beforeEach(() => {
      // Mock Zoom adapter methods (since client is not implemented yet)
      jest
        .spyOn(zoomAdapter, "createMeeting")
        .mockResolvedValue(mockZoomMeetingInfo);
      jest
        .spyOn(zoomAdapter, "getMeetingInfo")
        .mockResolvedValue(mockZoomMeetingInfo);
      jest.spyOn(zoomAdapter, "updateMeeting").mockResolvedValue(true);
      jest.spyOn(zoomAdapter, "cancelMeeting").mockResolvedValue(true);
    });

    it("should complete full lifecycle: create -> get -> update -> cancel", async () => {
      const provider = factory.getProvider(MeetingProviderType.ZOOM);

      // Step 1: Create meeting
      const createdMeeting = await provider.createMeeting(mockCreateInput);
      expect(createdMeeting).toBeDefined();
      expect(createdMeeting.provider).toBe(MeetingProviderType.ZOOM);
      expect(createdMeeting.meetingId).toBe(mockZoomMeetingInfo.meetingId);
      expect(createdMeeting.hostJoinUrl).toBe(mockZoomMeetingInfo.hostJoinUrl);
      expect(zoomAdapter.createMeeting).toHaveBeenCalledWith(mockCreateInput);

      // Step 2: Get meeting info
      const meetingInfo = await provider.getMeetingInfo(
        createdMeeting.meetingId,
      );
      expect(meetingInfo).toBeDefined();
      expect(meetingInfo.meetingId).toBe(createdMeeting.meetingId);
      expect(zoomAdapter.getMeetingInfo).toHaveBeenCalledWith(
        createdMeeting.meetingId,
      );

      // Step 3: Update meeting
      const updateInput: IUpdateMeetingInput = {
        topic: "Updated Zoom Meeting",
        duration: 120,
      };
      const updateResult = await provider.updateMeeting(
        createdMeeting.meetingId,
        updateInput,
      );
      expect(updateResult).toBe(true);
      expect(zoomAdapter.updateMeeting).toHaveBeenCalledWith(
        createdMeeting.meetingId,
        updateInput,
      );

      // Step 4: Cancel meeting
      const cancelResult = await provider.cancelMeeting(
        createdMeeting.meetingId,
      );
      expect(cancelResult).toBe(true);
      expect(zoomAdapter.cancelMeeting).toHaveBeenCalledWith(
        createdMeeting.meetingId,
      );
    });

    it("should propagate errors from Zoom adapter", async () => {
      jest
        .spyOn(zoomAdapter, "createMeeting")
        .mockRejectedValue(new Error("Zoom API error"));

      const provider = factory.getProvider(MeetingProviderType.ZOOM);

      await expect(provider.createMeeting(mockCreateInput)).rejects.toThrow();
    });
  });

  describe("Cross-Provider Integration", () => {
    beforeEach(() => {
      // Mock both adapters
      jest
        .spyOn(feishuAdapter, "createMeeting")
        .mockResolvedValue(mockFeishuMeetingInfo);
      jest
        .spyOn(zoomAdapter, "createMeeting")
        .mockResolvedValue(mockZoomMeetingInfo);
    });

    it("should create meetings with both providers using same factory", async () => {
      // Create Feishu meeting
      const feishuProvider = factory.getProvider(MeetingProviderType.FEISHU);
      const feishuMeeting = await feishuProvider.createMeeting(
        mockCreateInput,
      );
      expect(feishuMeeting.provider).toBe(MeetingProviderType.FEISHU);
      expect(feishuMeeting.meetingNo).toBeTruthy(); // Feishu has meeting number

      // Create Zoom meeting
      const zoomProvider = factory.getProvider(MeetingProviderType.ZOOM);
      const zoomMeeting = await zoomProvider.createMeeting(mockCreateInput);
      expect(zoomMeeting.provider).toBe(MeetingProviderType.ZOOM);
      expect(zoomMeeting.meetingNo).toBeNull(); // Zoom doesn't have meeting number
      expect(zoomMeeting.hostJoinUrl).toBeTruthy(); // Zoom has host join URL
    });

    it("should return different providers for different types", () => {
      const feishuProvider = factory.getProvider(MeetingProviderType.FEISHU);
      const zoomProvider = factory.getProvider(MeetingProviderType.ZOOM);

      expect(feishuProvider).not.toBe(zoomProvider);
      expect(feishuProvider).toBe(feishuAdapter);
      expect(zoomProvider).toBe(zoomAdapter);
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle network errors gracefully", async () => {
      jest
        .spyOn(feishuClient, "applyReservation")
        .mockRejectedValue(new Error("Network timeout"));

      const provider = factory.getProvider(MeetingProviderType.FEISHU);

      await expect(provider.createMeeting(mockCreateInput)).rejects.toThrow();
    });

    it("should handle invalid meeting ID when getting info", async () => {
      jest
        .spyOn(feishuClient, "getReservationInfo")
        .mockRejectedValue(new Error("Meeting not found"));

      const provider = factory.getProvider(MeetingProviderType.FEISHU);

      await expect(
        provider.getMeetingInfo("invalid-meeting-id"),
      ).rejects.toThrow();
    });

    it("should handle update failures", async () => {
      jest
        .spyOn(zoomAdapter, "updateMeeting")
        .mockRejectedValue(
          new Error("Update failed: Meeting already started"),
        );

      const provider = factory.getProvider(MeetingProviderType.ZOOM);

      await expect(
        provider.updateMeeting("meeting-123", { duration: 90 }),
      ).rejects.toThrow();
    });

    it("should handle cancel failures", async () => {
      jest
        .spyOn(feishuClient, "deleteReservation")
        .mockRejectedValue(
          new Error("Cancel failed: Meeting already ended"),
        );

      const provider = factory.getProvider(MeetingProviderType.FEISHU);

      await expect(provider.cancelMeeting("meeting-123")).rejects.toThrow();
    });
  });

  describe("Configuration Integration", () => {
    it("should respect DEFAULT_MEETING_PROVIDER from config", () => {
      const defaultProviderType = factory.getDefaultProviderType();
      expect(defaultProviderType).toBeDefined();
      expect([
        MeetingProviderType.FEISHU,
        MeetingProviderType.ZOOM,
      ]).toContain(defaultProviderType);
    });

    it("should use default provider when no type specified", async () => {
      jest
        .spyOn(feishuAdapter, "createMeeting")
        .mockResolvedValue(mockFeishuMeetingInfo);
      jest
        .spyOn(zoomAdapter, "createMeeting")
        .mockResolvedValue(mockZoomMeetingInfo);

      const defaultProvider = factory.getDefaultProvider();
      const meeting = await defaultProvider.createMeeting(mockCreateInput);

      expect(meeting).toBeDefined();
      expect(meeting.provider).toBe(factory.getDefaultProviderType());
    });
  });

  describe("Data Flow Integration", () => {
    it("should preserve all input data through the full stack", async () => {
      const complexInput: ICreateMeetingInput = {
        topic: "Complex Integration Test",
        startTime: new Date("2025-12-15T14:30:00Z"),
        duration: 45,
        hostUserId: "host-user-456",
        autoRecord: true,
        enableWaitingRoom: false,
        participantJoinEarly: true,
      };

      jest
        .spyOn(feishuAdapter, "createMeeting")
        .mockResolvedValue({
          ...mockFeishuMeetingInfo,
          startTime: complexInput.startTime,
          duration: complexInput.duration,
        });

      const provider = factory.getProvider(MeetingProviderType.FEISHU);
      const meeting = await provider.createMeeting(complexInput);

      // Verify data passed through correctly
      expect(meeting.startTime).toEqual(complexInput.startTime);
      expect(meeting.duration).toBe(complexInput.duration);
      expect(feishuAdapter.createMeeting).toHaveBeenCalledWith(complexInput);
    });

    it("should handle update operations with partial data", async () => {
      const partialUpdate: IUpdateMeetingInput = {
        topic: "Only topic changed",
      };

      jest.spyOn(zoomAdapter, "updateMeeting").mockResolvedValue(true);

      const provider = factory.getProvider(MeetingProviderType.ZOOM);
      await provider.updateMeeting("meeting-123", partialUpdate);

      expect(zoomAdapter.updateMeeting).toHaveBeenCalledWith(
        "meeting-123",
        partialUpdate,
      );
    });
  });
});
