import { Test, TestingModule } from "@nestjs/testing";
import { FeishuWebhookHandler } from "./feishu-webhook.handler";
import { FeishuEventExtractor } from "../extractors/feishu-event-extractor";
import { MeetingEventService } from "@core/meeting-providers/services/meeting-event.service";
import { WebhookEventBusService } from "../services/webhook-event-bus.service";
import { IWebhookEvent } from "../interfaces/webhook-handler.interface";

describe("FeishuWebhookHandler", () => {
  let handler: FeishuWebhookHandler;
  let mockFeishuExtractor: jest.Mocked<FeishuEventExtractor>;
  let mockMeetingEventService: jest.Mocked<MeetingEventService>;
  let mockEventBus: jest.Mocked<WebhookEventBusService>;

  beforeEach(async () => {
    // Mock services
    mockFeishuExtractor = {
      extract: jest.fn(),
    } as any;

    mockMeetingEventService = {
      recordEvent: jest.fn(),
    } as any;

    mockEventBus = {
      publish: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeishuWebhookHandler,
        {
          provide: FeishuEventExtractor,
          useValue: mockFeishuExtractor,
        },
        {
          provide: MeetingEventService,
          useValue: mockMeetingEventService,
        },
        {
          provide: WebhookEventBusService,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    handler = module.get<FeishuWebhookHandler>(FeishuWebhookHandler);
  });

  describe("getSupportedEventTypes", () => {
    it("should return all supported Feishu event types", () => {
      const supportedTypes = handler.getSupportedEventTypes();

      expect(supportedTypes).toContain("vc.meeting.meeting_started_v1");
      expect(supportedTypes).toContain("vc.meeting.meeting_ended_v1");
      expect(supportedTypes).toContain("vc.meeting.recording_ready_v1");
      expect(supportedTypes).toContain("vc.meeting.recording_started_v1");
      expect(supportedTypes).toContain("vc.meeting.recording_ended_v1");
      expect(supportedTypes).toContain("vc.meeting.join_meeting_v1");
      expect(supportedTypes).toContain("vc.meeting.leave_meeting_v1");
      expect(supportedTypes).toContain("vc.meeting.share_started_v1");
      expect(supportedTypes).toContain("vc.meeting.share_ended_v1");
    });
  });

  describe("handleEvent", () => {
    it("should handle meeting_started event and extract -> store -> publish flow", async () => {
      const mockEvent: IWebhookEvent = {
        eventType: "vc.meeting.meeting_started_v1",
        eventData: {
          meeting: {
            id: "meeting_123",
            meeting_no: "123456789",
            topic: "Test Meeting",
            start_time: "1608883322",
            end_time: "1608883899",
          },
          operator: {
            id: { user_id: "operator_1", open_id: "ou_123" },
            user_role: 1,
          },
        },
        timestamp: Date.now(),
        eventId: "event_123",
      };

      const mockExtractedData = {
        meetingId: "meeting_123",
        meetingNo: "123456789",
        eventId: "event_123",
        eventType: "vc.meeting.meeting_started_v1",
        provider: "feishu",
        operatorId: "operator_1",
        operatorRole: 1,
        meetingTopic: "Test Meeting",
        meetingStartTime: new Date("2020-12-25T10:08:42Z"),
        meetingEndTime: new Date("2020-12-25T10:24:59Z"),
        recordingId: null,
        recordingUrl: null,
        occurredAt: new Date(),
        eventData: mockEvent.eventData,
      };

      mockFeishuExtractor.extract.mockReturnValue(mockExtractedData);
      mockMeetingEventService.recordEvent.mockResolvedValue({
        id: "event_record_1",
        meetingId: "meeting_123",
        eventId: "event_123",
      } as any);

      mockEventBus.publish.mockResolvedValue(undefined);

      await handler.handleEvent(mockEvent);

      // Verify extraction
      expect(mockFeishuExtractor.extract).toHaveBeenCalledWith(
        mockEvent.eventData
      );

      // Verify storage
      expect(mockMeetingEventService.recordEvent).toHaveBeenCalledWith(
        mockExtractedData
      );

      // Verify publication
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should handle join_meeting event", async () => {
      const mockEvent: IWebhookEvent = {
        eventType: "vc.meeting.join_meeting_v1",
        eventData: {
          meeting: { id: "meeting_456", meeting_no: "456789123" },
          operator: { id: { user_id: "participant_1" }, user_role: 2 },
        },
        timestamp: Date.now(),
      };

      const mockExtractedData = {
        meetingId: "meeting_456",
        meetingNo: "456789123",
        eventId: "event_join_1",
        eventType: "vc.meeting.join_meeting_v1",
        provider: "feishu",
        operatorId: "participant_1",
        operatorRole: 2,
        meetingTopic: null,
        meetingStartTime: null,
        meetingEndTime: null,
        recordingId: null,
        recordingUrl: null,
        occurredAt: new Date(),
        eventData: mockEvent.eventData,
      };

      mockFeishuExtractor.extract.mockReturnValue(mockExtractedData);
      mockMeetingEventService.recordEvent.mockResolvedValue({} as any);
      mockEventBus.publish.mockResolvedValue(undefined);

      await handler.handleEvent(mockEvent);

      expect(mockFeishuExtractor.extract).toHaveBeenCalled();
      expect(mockMeetingEventService.recordEvent).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should handle recording_ready event", async () => {
      const mockEvent: IWebhookEvent = {
        eventType: "vc.meeting.recording_ready_v1",
        eventData: {
          meeting: { id: "meeting_789", meeting_no: "789123456" },
          recording: {
            id: "rec_001",
            url: "https://example.com/recording/001",
            duration: 3600,
          },
        },
        timestamp: Date.now(),
      };

      const mockExtractedData = {
        meetingId: "meeting_789",
        meetingNo: "789123456",
        eventId: "event_rec_1",
        eventType: "vc.meeting.recording_ready_v1",
        provider: "feishu",
        operatorId: null,
        operatorRole: null,
        meetingTopic: null,
        meetingStartTime: null,
        meetingEndTime: null,
        recordingId: "rec_001",
        recordingUrl: "https://example.com/recording/001",
        occurredAt: new Date(),
        eventData: mockEvent.eventData,
      };

      mockFeishuExtractor.extract.mockReturnValue(mockExtractedData);
      mockMeetingEventService.recordEvent.mockResolvedValue({} as any);
      mockEventBus.publish.mockResolvedValue(undefined);

      await handler.handleEvent(mockEvent);

      expect(mockMeetingEventService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          recordingId: "rec_001",
          recordingUrl: "https://example.com/recording/001",
        })
      );
    });

    it("should handle leave_meeting event", async () => {
      const mockEvent: IWebhookEvent = {
        eventType: "vc.meeting.leave_meeting_v1",
        eventData: {
          meeting: { id: "meeting_101", meeting_no: "101112131" },
          operator: { id: { user_id: "participant_2" }, user_role: 2 },
        },
        timestamp: Date.now(),
      };

      const mockExtractedData = {
        meetingId: "meeting_101",
        meetingNo: "101112131",
        eventId: "event_leave_1",
        eventType: "vc.meeting.leave_meeting_v1",
        provider: "feishu",
        operatorId: "participant_2",
        operatorRole: 2,
        meetingTopic: null,
        meetingStartTime: null,
        meetingEndTime: null,
        recordingId: null,
        recordingUrl: null,
        occurredAt: new Date(),
        eventData: mockEvent.eventData,
      };

      mockFeishuExtractor.extract.mockReturnValue(mockExtractedData);
      mockMeetingEventService.recordEvent.mockResolvedValue({} as any);
      mockEventBus.publish.mockResolvedValue(undefined);

      await handler.handleEvent(mockEvent);

      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it("should throw error for unsupported event type", async () => {
      const mockEvent: IWebhookEvent = {
        eventType: "vc.unknown.event_v1",
        eventData: {},
        timestamp: Date.now(),
      };

      await expect(handler.handleEvent(mockEvent)).rejects.toThrow();
    });

    it("should handle extraction errors gracefully", async () => {
      const mockEvent: IWebhookEvent = {
        eventType: "vc.meeting.meeting_started_v1",
        eventData: {},
        timestamp: Date.now(),
      };

      mockFeishuExtractor.extract.mockImplementation(() => {
        throw new Error("Extraction failed");
      });

      await expect(handler.handleEvent(mockEvent)).rejects.toThrow(
        "Extraction failed"
      );
    });

    it("should handle storage errors gracefully", async () => {
      const mockEvent: IWebhookEvent = {
        eventType: "vc.meeting.meeting_started_v1",
        eventData: {
          meeting: { id: "meeting_error", meeting_no: "999999999" },
        },
        timestamp: Date.now(),
      };

      const mockExtractedData = {
        meetingId: "meeting_error",
        meetingNo: "999999999",
        eventId: "event_error",
        eventType: "vc.meeting.meeting_started_v1",
        provider: "feishu",
        operatorId: null,
        operatorRole: null,
        meetingTopic: null,
        meetingStartTime: null,
        meetingEndTime: null,
        recordingId: null,
        recordingUrl: null,
        occurredAt: new Date(),
        eventData: mockEvent.eventData,
      };

      mockFeishuExtractor.extract.mockReturnValue(mockExtractedData);
      mockMeetingEventService.recordEvent.mockRejectedValue(
        new Error("Storage failed")
      );

      await expect(handler.handleEvent(mockEvent)).rejects.toThrow(
        "Storage failed"
      );
    });

    it("should handle event bus publication errors gracefully", async () => {
      const mockEvent: IWebhookEvent = {
        eventType: "vc.meeting.meeting_started_v1",
        eventData: { meeting: { id: "meeting_pub_error" } },
        timestamp: Date.now(),
      };

      const mockExtractedData = {
        meetingId: "meeting_pub_error",
        meetingNo: null,
        eventId: "event_pub_error",
        eventType: "vc.meeting.meeting_started_v1",
        provider: "feishu",
        operatorId: null,
        operatorRole: null,
        meetingTopic: null,
        meetingStartTime: null,
        meetingEndTime: null,
        recordingId: null,
        recordingUrl: null,
        occurredAt: new Date(),
        eventData: mockEvent.eventData,
      };

      mockFeishuExtractor.extract.mockReturnValue(mockExtractedData);
      mockMeetingEventService.recordEvent.mockResolvedValue({} as any);
      mockEventBus.publish.mockRejectedValue(
        new Error("Publication failed")
      );

      await expect(handler.handleEvent(mockEvent)).rejects.toThrow(
        "Publication failed"
      );
    });
  });

  describe("event type routing", () => {
    it("should route all supported event types correctly", async () => {
      const eventTypes = [
        "vc.meeting.meeting_started_v1",
        "vc.meeting.meeting_ended_v1",
        "vc.meeting.recording_ready_v1",
        "vc.meeting.recording_started_v1",
        "vc.meeting.recording_ended_v1",
        "vc.meeting.join_meeting_v1",
        "vc.meeting.leave_meeting_v1",
        "vc.meeting.share_started_v1",
        "vc.meeting.share_ended_v1",
      ];

      const mockExtractedData = {
        meetingId: "test_meeting",
        meetingNo: "111111111",
        eventId: "test_event",
        eventType: "vc.meeting.meeting_started_v1",
        provider: "feishu",
        operatorId: null,
        operatorRole: null,
        meetingTopic: null,
        meetingStartTime: null,
        meetingEndTime: null,
        recordingId: null,
        recordingUrl: null,
        occurredAt: new Date(),
        eventData: {},
      };

      mockFeishuExtractor.extract.mockReturnValue(mockExtractedData);
      mockMeetingEventService.recordEvent.mockResolvedValue({} as any);
      mockEventBus.publish.mockResolvedValue(undefined);

      for (const eventType of eventTypes) {
        const mockEvent: IWebhookEvent = {
          eventType,
          eventData: {},
          timestamp: Date.now(),
        };

        await handler.handleEvent(mockEvent);

        expect(mockMeetingEventService.recordEvent).toHaveBeenCalled();
        expect(mockEventBus.publish).toHaveBeenCalled();
      }

      expect(mockMeetingEventService.recordEvent).toHaveBeenCalledTimes(
        eventTypes.length
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(eventTypes.length);
    });
  });
});

