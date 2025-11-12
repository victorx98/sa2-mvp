import { Test, TestingModule } from "@nestjs/testing";
import { MeetingEventService } from "./meeting-event.service";
import { MeetingEventRepository } from "../repositories/meeting-event.repository";
import type { ExtractedMeetingEventData } from "@core/webhook/extractors/feishu-event-extractor";

describe("MeetingEventService", () => {
  let service: MeetingEventService;
  let mockRepository: jest.Mocked<MeetingEventRepository>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findByEventId: jest.fn(),
      findByMeetingNo: jest.fn(),
      findByMeetingId: jest.fn(),
      findJoinLeaveEvents: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingEventService,
        {
          provide: MeetingEventRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MeetingEventService>(MeetingEventService);
  });

  describe("recordEvent", () => {
    it("should create new event if it doesn't exist (deduplication)", async () => {
      const eventData: ExtractedMeetingEventData = {
        meetingId: "meeting_123",
        meetingNo: "123456789",
        eventId: "event_unique_001",
        eventType: "vc.meeting.join_meeting_v1",
        provider: "feishu",
        operatorId: "operator_1",
        operatorRole: 1,
        meetingTopic: "Test Meeting",
        meetingStartTime: new Date("2021-01-01T10:00:00Z"),
        meetingEndTime: new Date("2021-01-01T11:00:00Z"),
        recordingId: null,
        recordingUrl: null,
        occurredAt: new Date(),
        eventData: { test: "data" },
      };

      const mockCreatedEvent = {
        id: "record_1",
        ...eventData,
      };

      mockRepository.findByEventId.mockResolvedValue(null); // Event doesn't exist
      mockRepository.create.mockResolvedValue(mockCreatedEvent as any);

      const result = await service.recordEvent(eventData);

      expect(mockRepository.findByEventId).toHaveBeenCalledWith(
        eventData.eventId
      );
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingId: eventData.meetingId,
          eventId: eventData.eventId,
          eventType: eventData.eventType,
        })
      );
      expect(result).toEqual(mockCreatedEvent);
    });

    it("should return existing event without creating duplicate (idempotency)", async () => {
      const eventData: ExtractedMeetingEventData = {
        meetingId: "meeting_456",
        meetingNo: "456789123",
        eventId: "event_duplicate_001",
        eventType: "vc.meeting.join_meeting_v1",
        provider: "feishu",
        operatorId: "operator_2",
        operatorRole: 2,
        meetingTopic: null,
        meetingStartTime: null,
        meetingEndTime: null,
        recordingId: null,
        recordingUrl: null,
        occurredAt: new Date(),
        eventData: {},
      };

      const existingEvent = {
        id: "record_2",
        ...eventData,
      };

      mockRepository.findByEventId.mockResolvedValue(existingEvent as any);

      const result = await service.recordEvent(eventData);

      expect(mockRepository.findByEventId).toHaveBeenCalledWith(
        eventData.eventId
      );
      expect(mockRepository.create).not.toHaveBeenCalled(); // Should not create
      expect(result).toEqual(existingEvent);
    });

    it("should pass transaction to repository if provided", async () => {
      const eventData: ExtractedMeetingEventData = {
        meetingId: "meeting_789",
        meetingNo: "789123456",
        eventId: "event_tx_001",
        eventType: "vc.meeting.join_meeting_v1",
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

      const mockTx = {} as any;
      const mockCreatedEvent = { id: "record_3", ...eventData };

      mockRepository.findByEventId.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockCreatedEvent as any);

      const result = await service.recordEvent(eventData, mockTx);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.any(Object),
        mockTx
      );
      expect(result).toEqual(mockCreatedEvent);
    });
  });

  describe("findByEventId", () => {
    it("should find event by event_id", async () => {
      const eventId = "event_find_001";
      const mockEvent = {
        id: "record_4",
        eventId,
        meetingId: "meeting_find",
        provider: "feishu",
      };

      mockRepository.findByEventId.mockResolvedValue(mockEvent as any);

      const result = await service.findByEventId(eventId);

      expect(mockRepository.findByEventId).toHaveBeenCalledWith(eventId);
      expect(result).toEqual(mockEvent);
    });

    it("should return null if event_id not found", async () => {
      mockRepository.findByEventId.mockResolvedValue(null);

      const result = await service.findByEventId("nonexistent_event");

      expect(result).toBeNull();
    });
  });

  describe("findByMeetingNo", () => {
    it("should find all events by meeting_no", async () => {
      const meetingNo = "123456789";
      const mockEvents = [
        {
          id: "record_5",
          eventId: "event_001",
          meetingNo,
          eventType: "vc.meeting.join_meeting_v1",
        },
        {
          id: "record_6",
          eventId: "event_002",
          meetingNo,
          eventType: "vc.meeting.leave_meeting_v1",
        },
      ];

      mockRepository.findByMeetingNo.mockResolvedValue(mockEvents as any);

      const result = await service.findByMeetingNo(meetingNo);

      expect(mockRepository.findByMeetingNo).toHaveBeenCalledWith(meetingNo);
      expect(result).toEqual(mockEvents);
      expect(result.length).toBe(2);
    });

    it("should return empty array if no events found for meeting_no", async () => {
      mockRepository.findByMeetingNo.mockResolvedValue([]);

      const result = await service.findByMeetingNo("no_events_meeting");

      expect(result).toEqual([]);
    });
  });

  describe("findByMeetingId", () => {
    it("should find all events by meeting_id", async () => {
      const meetingId = "meeting_456";
      const mockEvents = [
        {
          id: "record_7",
          eventId: "event_003",
          meetingId,
          provider: "feishu",
        },
        {
          id: "record_8",
          eventId: "event_004",
          meetingId,
          provider: "feishu",
        },
      ];

      mockRepository.findByMeetingId.mockResolvedValue(mockEvents as any);

      const result = await service.findByMeetingId(meetingId);

      expect(mockRepository.findByMeetingId).toHaveBeenCalledWith(meetingId);
      expect(result).toEqual(mockEvents);
      expect(result.length).toBe(2);
    });

    it("should return empty array if no events found for meeting_id", async () => {
      mockRepository.findByMeetingId.mockResolvedValue([]);

      const result = await service.findByMeetingId("no_events_id");

      expect(result).toEqual([]);
    });
  });

  describe("findJoinLeaveEvents", () => {
    it("should find join and leave events for duration calculation", async () => {
      const meetingNo = "123456789";
      const mockEvents = [
        {
          id: "record_9",
          eventId: "event_join_001",
          eventType: "vc.meeting.join_meeting_v1",
          occurredAt: new Date("2021-01-01T10:00:00Z"),
        },
        {
          id: "record_10",
          eventId: "event_leave_001",
          eventType: "vc.meeting.leave_meeting_v1",
          occurredAt: new Date("2021-01-01T10:30:00Z"),
        },
      ];

      mockRepository.findJoinLeaveEvents.mockResolvedValue(mockEvents as any);

      const result = await service.findJoinLeaveEvents(meetingNo);

      expect(mockRepository.findJoinLeaveEvents).toHaveBeenCalledWith(
        meetingNo,
        [
          "vc.meeting.join_meeting_v1",
          "vc.meeting.leave_meeting_v1",
          "meeting.participant_joined",
          "meeting.participant_left",
        ]
      );
      expect(result).toEqual(mockEvents);
      expect(result.length).toBe(2);
    });

    it("should return empty array if no join/leave events found", async () => {
      mockRepository.findJoinLeaveEvents.mockResolvedValue([]);

      const result = await service.findJoinLeaveEvents("no_events_meeting");

      expect(result).toEqual([]);
    });

    it("should filter for both Feishu and Zoom join/leave event types", async () => {
      const meetingNo = "mixed_events";
      const mockEvents = [
        {
          id: "record_11",
          eventType: "vc.meeting.join_meeting_v1", // Feishu
          provider: "feishu",
        },
        {
          id: "record_12",
          eventType: "meeting.participant_joined", // Zoom
          provider: "zoom",
        },
      ];

      mockRepository.findJoinLeaveEvents.mockResolvedValue(mockEvents as any);

      const result = await service.findJoinLeaveEvents(meetingNo);

      expect(result.length).toBe(2);
      expect(mockRepository.findJoinLeaveEvents).toHaveBeenCalledWith(
        meetingNo,
        expect.arrayContaining([
          "vc.meeting.join_meeting_v1",
          "vc.meeting.leave_meeting_v1",
          "meeting.participant_joined",
          "meeting.participant_left",
        ])
      );
    });
  });

  describe("recording events", () => {
    it("should handle recording_ready event", async () => {
      const eventData: ExtractedMeetingEventData = {
        meetingId: "meeting_rec_001",
        meetingNo: "rec_meeting_001",
        eventId: "event_rec_ready",
        eventType: "vc.meeting.recording_ready_v1",
        provider: "feishu",
        operatorId: null,
        operatorRole: null,
        meetingTopic: null,
        meetingStartTime: null,
        meetingEndTime: null,
        recordingId: "rec_123",
        recordingUrl: "https://example.com/recording/123",
        occurredAt: new Date(),
        eventData: { recording: { id: "rec_123", url: "https://..." } },
      };

      const mockCreatedEvent = { id: "record_rec", ...eventData };

      mockRepository.findByEventId.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockCreatedEvent as any);

      const result = await service.recordEvent(eventData);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recordingId: "rec_123",
          recordingUrl: "https://example.com/recording/123",
        })
      );
      expect(result).toEqual(mockCreatedEvent);
    });
  });

  describe("event data preservation", () => {
    it("should preserve complete raw event data in eventData field", async () => {
      const rawData = {
        meeting: { id: "meeting_preserve" },
        operator: { id: { user_id: "user_1" } },
        customField: "customValue",
      };

      const eventData: ExtractedMeetingEventData = {
        meetingId: "meeting_preserve",
        meetingNo: null,
        eventId: "event_preserve",
        eventType: "vc.meeting.join_meeting_v1",
        provider: "feishu",
        operatorId: "user_1",
        operatorRole: null,
        meetingTopic: null,
        meetingStartTime: null,
        meetingEndTime: null,
        recordingId: null,
        recordingUrl: null,
        occurredAt: new Date(),
        eventData: rawData,
      };

      const mockCreatedEvent = { id: "record_preserved", ...eventData };

      mockRepository.findByEventId.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockCreatedEvent as any);

      const result = await service.recordEvent(eventData);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          eventData: rawData,
        })
      );
      expect(result.eventData).toEqual(rawData);
    });
  });
});

