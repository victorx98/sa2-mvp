import { Test, TestingModule } from "@nestjs/testing";
import { SessionLifecycleService } from "./session-lifecycle.service";
import { SessionService } from "./session.service";
import { SessionEventRepository } from "../repositories/session-event.repository";
import { SessionDurationCalculator } from "./session-duration-calculator";
import { SessionRecordingManager } from "../recording/session-recording-manager";
import { TranscriptPollingService } from "../recording/transcript-polling.service";
import { AISummaryService } from "../recording/ai-summary.service";
import { IWebhookEvent } from "@core/webhook/interfaces/webhook-handler.interface";
import { SessionStatus } from "../interfaces/session.interface";

describe("SessionLifecycleService", () => {
  let service: SessionLifecycleService;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockSessionEventRepository: jest.Mocked<SessionEventRepository>;
  let mockDurationCalculator: jest.Mocked<SessionDurationCalculator>;
  let mockRecordingManager: jest.Mocked<SessionRecordingManager>;
  let mockTranscriptPollingService: jest.Mocked<TranscriptPollingService>;
  let mockAISummaryService: jest.Mocked<AISummaryService>;

  const mockSession = {
    id: "00000000-0000-0000-0000-000000000001",
    studentId: "00000000-0000-0000-0000-000000000002",
    mentorId: "00000000-0000-0000-0000-000000000003",
    meetingId: "6892847362938471942",
    meetingProvider: "feishu",
    scheduledStartTime: new Date(),
    scheduledDuration: 60,
    sessionName: "Test Session",
    status: SessionStatus.SCHEDULED,
    recordings: [],
    aiSummary: null,
    mentorJoinCount: 0,
    studentJoinCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    meetingNo: null,
    meetingUrl: null,
    meetingPassword: null,
    actualStartTime: null,
    actualEndTime: null,
    mentorTotalDurationSeconds: null,
    studentTotalDurationSeconds: null,
    effectiveTutoringDurationSeconds: null,
    notes: null,
    contractId: null,
  };

  beforeEach(async () => {
    // Create mocks
    mockSessionService = {
      getSessionByMeetingId: jest.fn(),
      updateSession: jest.fn(),
    } as any;

    mockSessionEventRepository = {
      create: jest.fn(),
    } as any;

    mockDurationCalculator = {
      calculateDurations: jest.fn(),
    } as any;

    mockRecordingManager = {
      appendRecording: jest.fn(),
      isAllTranscriptsFetched: jest.fn(),
    } as any;

    mockTranscriptPollingService = {
      startPolling: jest.fn(),
    } as any;

    mockAISummaryService = {
      generateSummary: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionLifecycleService,
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: SessionEventRepository,
          useValue: mockSessionEventRepository,
        },
        {
          provide: SessionDurationCalculator,
          useValue: mockDurationCalculator,
        },
        {
          provide: SessionRecordingManager,
          useValue: mockRecordingManager,
        },
        {
          provide: TranscriptPollingService,
          useValue: mockTranscriptPollingService,
        },
        {
          provide: AISummaryService,
          useValue: mockAISummaryService,
        },
      ],
    }).compile();

    service = module.get<SessionLifecycleService>(SessionLifecycleService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleMeetingStarted", () => {
    it("should update session with actual start time and status", async () => {
      const event: IWebhookEvent = {
        eventId: "event-001",
        eventType: "vc.meeting.meeting_started_v1",
        timestamp: new Date("2025-11-06T10:00:00Z").getTime(),
        eventData: {
          meeting: { id: "6892847362938471942" },
        },
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(mockSession);
      mockSessionEventRepository.create.mockResolvedValue({} as any);
      mockSessionService.updateSession.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.STARTED,
        actualStartTime: new Date(event.timestamp),
      });

      await service.handleMeetingStarted(event);

      expect(mockSessionService.getSessionByMeetingId).toHaveBeenCalledWith(
        "6892847362938471942",
      );
      expect(mockSessionEventRepository.create).toHaveBeenCalled();
      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({
          status: SessionStatus.STARTED,
          actualStartTime: expect.any(Date),
        }),
      );
    });

    it("should return early when meeting ID not found in event", async () => {
      const event: IWebhookEvent = {
        eventId: "event-001",
        eventType: "vc.meeting.meeting_started_v1",
        timestamp: new Date("2025-11-06T10:00:00Z").getTime(),
        eventData: {},
      };

      await service.handleMeetingStarted(event);

      expect(mockSessionService.getSessionByMeetingId).not.toHaveBeenCalled();
    });

    it("should return early when session not found", async () => {
      const event: IWebhookEvent = {
        eventId: "event-001",
        eventType: "vc.meeting.meeting_started_v1",
        timestamp: new Date("2025-11-06T10:00:00Z").getTime(),
        eventData: {
          meeting: { id: "non-existent-meeting" },
        },
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(null);

      await service.handleMeetingStarted(event);

      expect(mockSessionEventRepository.create).not.toHaveBeenCalled();
      expect(mockSessionService.updateSession).not.toHaveBeenCalled();
    });
  });

  describe("handleMeetingEnded", () => {
    it("should update session with end time and duration statistics", async () => {
      const event: IWebhookEvent = {
        eventId: "event-002",
        eventType: "vc.meeting.meeting_ended_v1",
        timestamp: new Date("2025-11-06T11:00:00Z").getTime(),
        eventData: {
          meeting: { id: "6892847362938471942" },
        },
      };

      const durationStats = {
        mentorTotalDurationSeconds: 3600,
        studentTotalDurationSeconds: 3500,
        effectiveTutoringDurationSeconds: 3400,
        mentorJoinCount: 2,
        studentJoinCount: 1,
        overlapIntervals: [],
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(mockSession);
      mockSessionEventRepository.create.mockResolvedValue({} as any);
      mockDurationCalculator.calculateDurations.mockResolvedValue(
        durationStats,
      );
      mockSessionService.updateSession.mockResolvedValue({
        ...mockSession,
        status: SessionStatus.COMPLETED,
        actualEndTime: new Date(event.timestamp),
        ...durationStats,
      });

      await service.handleMeetingEnded(event);

      expect(mockDurationCalculator.calculateDurations).toHaveBeenCalledWith(
        mockSession.id,
      );
      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({
          actualEndTime: expect.any(Date),
          status: SessionStatus.COMPLETED,
          mentorTotalDurationSeconds: 3600,
          studentTotalDurationSeconds: 3500,
          effectiveTutoringDurationSeconds: 3400,
          mentorJoinCount: 2,
          studentJoinCount: 1,
        }),
      );
    });

    it("should return early when session not found", async () => {
      const event: IWebhookEvent = {
        eventId: "event-002",
        eventType: "vc.meeting.meeting_ended_v1",
        timestamp: new Date("2025-11-06T11:00:00Z").getTime(),
        eventData: {
          meeting: { id: "non-existent-meeting" },
        },
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(null);

      await service.handleMeetingEnded(event);

      expect(mockDurationCalculator.calculateDurations).not.toHaveBeenCalled();
      expect(mockSessionService.updateSession).not.toHaveBeenCalled();
    });
  });

  describe("handleRecordingReady", () => {
    it("should append recording and start transcript polling", async () => {
      const event: IWebhookEvent = {
        eventId: "event-003",
        eventType: "vc.meeting.recording_ready_v1",
        timestamp: new Date("2025-11-06T12:00:00Z").getTime(),
        eventData: {
          meeting: { id: "6892847362938471942" },
          recording: {
            recording_id: "rec_001",
            url: "https://example.com/rec_001",
            duration: 3600,
            start_time: "2025-11-06T10:00:00Z",
            end_time: "2025-11-06T11:00:00Z",
          },
        },
      };

      const updatedRecordings = [
        {
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          transcriptUrl: null,
          duration: 3600,
          sequence: 1,
          startedAt: new Date("2025-11-06T10:00:00Z"),
          endedAt: new Date("2025-11-06T11:00:00Z"),
        },
      ];

      mockSessionService.getSessionByMeetingId.mockResolvedValue(mockSession);
      mockSessionEventRepository.create.mockResolvedValue({} as any);
      mockRecordingManager.appendRecording.mockResolvedValue(updatedRecordings);
      mockTranscriptPollingService.startPolling.mockResolvedValue();
      mockRecordingManager.isAllTranscriptsFetched.mockResolvedValue(false);

      await service.handleRecordingReady(event);

      expect(mockRecordingManager.appendRecording).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          duration: 3600,
        }),
      );
      expect(mockTranscriptPollingService.startPolling).toHaveBeenCalledWith(
        mockSession.id,
        "rec_001",
        "6892847362938471942",
        "feishu",
      );
    });

    it("should generate AI summary when all transcripts are fetched", async () => {
      const event: IWebhookEvent = {
        eventId: "event-004",
        eventType: "vc.meeting.recording_ready_v1",
        timestamp: new Date("2025-11-06T12:00:00Z").getTime(),
        eventData: {
          meeting: { id: "6892847362938471942" },
          recording: {
            recording_id: "rec_002",
            url: "https://example.com/rec_002",
            duration: 3600,
          },
        },
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(mockSession);
      mockSessionEventRepository.create.mockResolvedValue({} as any);
      mockRecordingManager.appendRecording.mockResolvedValue([]);
      mockTranscriptPollingService.startPolling.mockResolvedValue();
      mockRecordingManager.isAllTranscriptsFetched.mockResolvedValue(true);
      mockAISummaryService.generateSummary.mockResolvedValue(undefined);

      await service.handleRecordingReady(event);

      expect(mockRecordingManager.isAllTranscriptsFetched).toHaveBeenCalledWith(
        mockSession.id,
      );
      expect(mockAISummaryService.generateSummary).toHaveBeenCalledWith(
        mockSession.id,
      );
    });
  });

  describe("handleParticipantJoined", () => {
    it("should store join event for duration calculation", async () => {
      const event: IWebhookEvent = {
        eventId: "event-005",
        eventType: "vc.meeting.join_meeting_v1",
        timestamp: new Date("2025-11-06T10:00:00Z").getTime(),
        eventData: {
          meeting: { id: "6892847362938471942" },
          user: { id: mockSession.mentorId },
        },
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(mockSession);
      mockSessionEventRepository.create.mockResolvedValue({} as any);

      await service.handleParticipantJoined(event);

      expect(mockSessionEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: mockSession.id,
          provider: "feishu",
          eventType: "vc.meeting.join_meeting_v1",
          eventData: event.eventData,
          occurredAt: new Date(event.timestamp),
        }),
      );
    });
  });

  describe("handleParticipantLeft", () => {
    it("should store leave event for duration calculation", async () => {
      const event: IWebhookEvent = {
        eventId: "event-006",
        eventType: "vc.meeting.leave_meeting_v1",
        timestamp: new Date("2025-11-06T11:00:00Z").getTime(),
        eventData: {
          meeting: { id: "6892847362938471942" },
          user: { id: mockSession.mentorId },
        },
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(mockSession);
      mockSessionEventRepository.create.mockResolvedValue({} as any);

      await service.handleParticipantLeft(event);

      expect(mockSessionEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: mockSession.id,
          provider: "feishu",
          eventType: "vc.meeting.leave_meeting_v1",
          eventData: event.eventData,
          occurredAt: new Date(event.timestamp),
        }),
      );
    });
  });

  describe("handleRecordingStarted", () => {
    it("should store recording started event", async () => {
      const event: IWebhookEvent = {
        eventId: "event-007",
        eventType: "vc.meeting.recording_started_v1",
        timestamp: new Date("2025-11-06T10:00:00Z").getTime(),
        eventData: {
          meeting: { id: "6892847362938471942" },
        },
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(mockSession);
      mockSessionEventRepository.create.mockResolvedValue({} as any);

      await service.handleRecordingStarted(event);

      expect(mockSessionEventRepository.create).toHaveBeenCalled();
    });
  });

  describe("handleRecordingEnded", () => {
    it("should store recording ended event", async () => {
      const event: IWebhookEvent = {
        eventId: "event-008",
        eventType: "vc.meeting.recording_ended_v1",
        timestamp: new Date("2025-11-06T11:00:00Z").getTime(),
        eventData: {
          meeting: { id: "6892847362938471942" },
        },
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(mockSession);
      mockSessionEventRepository.create.mockResolvedValue({} as any);

      await service.handleRecordingEnded(event);

      expect(mockSessionEventRepository.create).toHaveBeenCalled();
    });
  });

  describe("handleShareStarted", () => {
    it("should store share started event", async () => {
      const event: IWebhookEvent = {
        eventId: "event-009",
        eventType: "vc.meeting.share_started_v1",
        timestamp: new Date("2025-11-06T10:30:00Z").getTime(),
        eventData: {
          meeting: { id: "6892847362938471942" },
        },
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(mockSession);
      mockSessionEventRepository.create.mockResolvedValue({} as any);

      await service.handleShareStarted(event);

      expect(mockSessionEventRepository.create).toHaveBeenCalled();
    });
  });

  describe("handleShareEnded", () => {
    it("should store share ended event", async () => {
      const event: IWebhookEvent = {
        eventId: "event-010",
        eventType: "vc.meeting.share_ended_v1",
        timestamp: new Date("2025-11-06T10:45:00Z").getTime(),
        eventData: {
          meeting: { id: "6892847362938471942" },
        },
      };

      mockSessionService.getSessionByMeetingId.mockResolvedValue(mockSession);
      mockSessionEventRepository.create.mockResolvedValue({} as any);

      await service.handleShareEnded(event);

      expect(mockSessionEventRepository.create).toHaveBeenCalled();
    });
  });
});
