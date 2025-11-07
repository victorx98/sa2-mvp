import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { SessionLifecycleService } from "@domains/services/session/services/session-lifecycle.service";
import { SessionService } from "@domains/services/session/services/session.service";
import { SessionEventRepository } from "@domains/services/session/repositories/session-event.repository";
import { SessionDurationCalculator } from "@domains/services/session/services/session-duration-calculator";
import { SessionRecordingManager } from "@domains/services/session/recording/session-recording-manager";
import { TranscriptPollingService } from "@domains/services/session/recording/transcript-polling.service";
import { AISummaryService } from "@domains/services/session/recording/ai-summary.service";
import { IWebhookEvent } from "@core/webhook/interfaces/webhook-handler.interface";
import { SessionStatus } from "@domains/services/session/interfaces/session.interface";

describe("Session Webhook Flow (e2e)", () => {
  let app: INestApplication;
  let sessionLifecycleService: SessionLifecycleService;
  let sessionService: SessionService;
  let sessionEventRepository: SessionEventRepository;
  let durationCalculator: SessionDurationCalculator;
  let recordingManager: SessionRecordingManager;

  const mockSession = {
    id: "00000000-0000-0000-0000-000000000001",
    studentId: "00000000-0000-0000-0000-000000000002",
    mentorId: "00000000-0000-0000-0000-000000000003",
    meetingId: "6892847362938471942",
    meetingProvider: "feishu",
    status: SessionStatus.SCHEDULED,
    scheduledStartTime: new Date("2025-11-10T14:00:00Z"),
    scheduledDuration: 60,
    sessionName: "Test Session",
    recordings: [],
    aiSummary: null,
    mentorJoinCount: 0,
    studentJoinCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        SessionLifecycleService,
        {
          provide: SessionService,
          useValue: {
            getSessionByMeetingId: jest.fn(),
            updateSession: jest.fn(),
            getSessionById: jest.fn(),
          },
        },
        {
          provide: SessionEventRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: SessionDurationCalculator,
          useValue: {
            calculateDurations: jest.fn(),
          },
        },
        {
          provide: SessionRecordingManager,
          useValue: {
            appendRecording: jest.fn(),
            isAllTranscriptsFetched: jest.fn(),
          },
        },
        {
          provide: TranscriptPollingService,
          useValue: {
            startPolling: jest.fn(),
          },
        },
        {
          provide: AISummaryService,
          useValue: {
            generateSummary: jest.fn(),
          },
        },
      ],
    }).compile();

    sessionLifecycleService = moduleFixture.get<SessionLifecycleService>(
      SessionLifecycleService,
    );
    sessionService = moduleFixture.get<SessionService>(SessionService);
    sessionEventRepository = moduleFixture.get<SessionEventRepository>(
      SessionEventRepository,
    );
    durationCalculator = moduleFixture.get<SessionDurationCalculator>(
      SessionDurationCalculator,
    );
    recordingManager = moduleFixture.get<SessionRecordingManager>(
      SessionRecordingManager,
    );

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Complete webhook lifecycle flow", () => {
    it("should handle meeting started -> ended -> recording ready flow", async () => {
      // Setup mocks
      (sessionService.getSessionByMeetingId as jest.Mock).mockResolvedValue(
        mockSession,
      );
      (sessionEventRepository.create as jest.Mock).mockResolvedValue({});
      (sessionService.updateSession as jest.Mock).mockResolvedValue(mockSession);

      // Step 1: Meeting Started
      const meetingStartedEvent: IWebhookEvent = {
        eventId: "event-001",
        eventType: "vc.meeting.meeting_started_v1",
        timestamp: "2025-11-10T14:02:00Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
        },
      };

      await sessionLifecycleService.handleMeetingStarted(meetingStartedEvent);

      expect(sessionService.getSessionByMeetingId).toHaveBeenCalledWith(
        mockSession.meetingId,
      );
      expect(sessionEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: mockSession.id,
          eventType: "vc.meeting.meeting_started_v1",
        }),
      );
      expect(sessionService.updateSession).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({
          status: SessionStatus.STARTED,
          actualStartTime: expect.any(Date),
        }),
      );

      // Step 2: Participants Join (for duration tracking)
      const mentorJoinEvent: IWebhookEvent = {
        eventId: "event-002",
        eventType: "vc.meeting.join_meeting_v1",
        timestamp: "2025-11-10T14:02:15Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
          user: { id: mockSession.mentorId },
        },
      };

      await sessionLifecycleService.handleParticipantJoined(mentorJoinEvent);

      const studentJoinEvent: IWebhookEvent = {
        eventId: "event-003",
        eventType: "vc.meeting.join_meeting_v1",
        timestamp: "2025-11-10T14:05:00Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
          user: { id: mockSession.studentId },
        },
      };

      await sessionLifecycleService.handleParticipantJoined(studentJoinEvent);

      // Step 3: Participants Leave
      const studentLeaveEvent: IWebhookEvent = {
        eventId: "event-004",
        eventType: "vc.meeting.leave_meeting_v1",
        timestamp: "2025-11-10T15:00:00Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
          user: { id: mockSession.studentId },
        },
      };

      await sessionLifecycleService.handleParticipantLeft(studentLeaveEvent);

      const mentorLeaveEvent: IWebhookEvent = {
        eventId: "event-005",
        eventType: "vc.meeting.leave_meeting_v1",
        timestamp: "2025-11-10T15:05:00Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
          user: { id: mockSession.mentorId },
        },
      };

      await sessionLifecycleService.handleParticipantLeft(mentorLeaveEvent);

      // Step 4: Meeting Ended with duration calculation
      const durationStats = {
        mentorTotalDurationSeconds: 3780, // ~63 minutes
        studentTotalDurationSeconds: 3300, // 55 minutes
        effectiveTutoringDurationSeconds: 3300, // 55 minutes
        mentorJoinCount: 1,
        studentJoinCount: 1,
        overlapIntervals: [],
      };

      (durationCalculator.calculateDurations as jest.Mock).mockResolvedValue(
        durationStats,
      );

      const meetingEndedEvent: IWebhookEvent = {
        eventId: "event-006",
        eventType: "vc.meeting.meeting_ended_v1",
        timestamp: "2025-11-10T15:05:00Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
        },
      };

      await sessionLifecycleService.handleMeetingEnded(meetingEndedEvent);

      expect(durationCalculator.calculateDurations).toHaveBeenCalledWith(
        mockSession.id,
      );
      expect(sessionService.updateSession).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({
          status: SessionStatus.COMPLETED,
          actualEndTime: expect.any(Date),
          ...durationStats,
        }),
      );

      // Step 5: Recording Ready
      (recordingManager.appendRecording as jest.Mock).mockResolvedValue([
        {
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
          transcriptUrl: null,
          duration: 3600,
          sequence: 1,
          startedAt: new Date("2025-11-10T14:02:00Z"),
          endedAt: new Date("2025-11-10T15:02:00Z"),
        },
      ]);
      (recordingManager.isAllTranscriptsFetched as jest.Mock).mockResolvedValue(false);

      const recordingReadyEvent: IWebhookEvent = {
        eventId: "event-007",
        eventType: "vc.meeting.recording_ready_v1",
        timestamp: "2025-11-10T15:10:00Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
          recording: {
            recording_id: "rec_001",
            url: "https://example.com/rec_001",
            duration: 3600,
            start_time: "2025-11-10T14:02:00Z",
            end_time: "2025-11-10T15:02:00Z",
          },
        },
      };

      await sessionLifecycleService.handleRecordingReady(recordingReadyEvent);

      expect(recordingManager.appendRecording).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({
          recordingId: "rec_001",
          recordingUrl: "https://example.com/rec_001",
        }),
      );

      // Verify all events were stored
      expect(sessionEventRepository.create).toHaveBeenCalledTimes(7);
    });

    it("should handle multiple recordings with transcript fetching", async () => {
      (sessionService.getSessionByMeetingId as jest.Mock).mockResolvedValue(
        mockSession,
      );
      (sessionEventRepository.create as jest.Mock).mockResolvedValue({});

      // First recording
      (recordingManager.appendRecording as jest.Mock).mockResolvedValueOnce([
        {
          recordingId: "rec_001",
          transcriptUrl: null,
          sequence: 1,
        },
      ]);
      (recordingManager.isAllTranscriptsFetched as jest.Mock).mockResolvedValueOnce(false);

      const firstRecordingEvent: IWebhookEvent = {
        eventId: "event-001",
        eventType: "vc.meeting.recording_ready_v1",
        timestamp: "2025-11-10T15:10:00Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
          recording: {
            recording_id: "rec_001",
            url: "https://example.com/rec_001",
            duration: 1800,
          },
        },
      };

      await sessionLifecycleService.handleRecordingReady(firstRecordingEvent);

      // Second recording - now all transcripts are fetched
      (recordingManager.appendRecording as jest.Mock).mockResolvedValueOnce([
        {
          recordingId: "rec_001",
          transcriptUrl: "https://example.com/transcript_001",
          sequence: 1,
        },
        {
          recordingId: "rec_002",
          transcriptUrl: "https://example.com/transcript_002",
          sequence: 2,
        },
      ]);
      (recordingManager.isAllTranscriptsFetched as jest.Mock).mockResolvedValueOnce(true);

      const secondRecordingEvent: IWebhookEvent = {
        eventId: "event-002",
        eventType: "vc.meeting.recording_ready_v1",
        timestamp: "2025-11-10T15:15:00Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
          recording: {
            recording_id: "rec_002",
            url: "https://example.com/rec_002",
            duration: 1800,
          },
        },
      };

      await sessionLifecycleService.handleRecordingReady(secondRecordingEvent);

      // Verify both recordings were appended
      expect(recordingManager.appendRecording).toHaveBeenCalledTimes(2);
      expect(recordingManager.isAllTranscriptsFetched).toHaveBeenCalledTimes(2);
    });

    it("should handle screen share events", async () => {
      (sessionService.getSessionByMeetingId as jest.Mock).mockResolvedValue(
        mockSession,
      );
      (sessionEventRepository.create as jest.Mock).mockResolvedValue({});

      // Share started
      const shareStartedEvent: IWebhookEvent = {
        eventId: "event-001",
        eventType: "vc.meeting.share_started_v1",
        timestamp: "2025-11-10T14:30:00Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
        },
      };

      await sessionLifecycleService.handleShareStarted(shareStartedEvent);

      expect(sessionEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: mockSession.id,
          eventType: "vc.meeting.share_started_v1",
        }),
      );

      // Share ended
      const shareEndedEvent: IWebhookEvent = {
        eventId: "event-002",
        eventType: "vc.meeting.share_ended_v1",
        timestamp: "2025-11-10T14:45:00Z",
        eventData: {
          meeting: { id: mockSession.meetingId },
        },
      };

      await sessionLifecycleService.handleShareEnded(shareEndedEvent);

      expect(sessionEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: mockSession.id,
          eventType: "vc.meeting.share_ended_v1",
        }),
      );
    });

    it("should gracefully handle webhook for non-existent session", async () => {
      (sessionService.getSessionByMeetingId as jest.Mock).mockResolvedValue(null);

      const event: IWebhookEvent = {
        eventId: "event-001",
        eventType: "vc.meeting.meeting_started_v1",
        timestamp: "2025-11-10T14:00:00Z",
        eventData: {
          meeting: { id: "non-existent-meeting" },
        },
      };

      // Should not throw error, just log warning
      await expect(
        sessionLifecycleService.handleMeetingStarted(event),
      ).resolves.not.toThrow();

      expect(sessionEventRepository.create).not.toHaveBeenCalled();
      expect(sessionService.updateSession).not.toHaveBeenCalled();
    });
  });
});
