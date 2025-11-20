import { Test, TestingModule } from "@nestjs/testing";
import { MentoringEventListener } from "./mentoring-event.listener";
import { MentoringService } from "../services/mentoring.service";
import { MeetingLifecycleCompletedEvent } from "@core/meeting/events/meeting-lifecycle.events";
import { MentoringSessionStatus } from "../entities/mentoring-session.entity";

describe("MentoringEventListener", () => {
  let listener: MentoringEventListener;
  let mentoringService: jest.Mocked<MentoringService>;

  // Test data
  const testMeetingId = "meeting-uuid-123";
  const testSessionId = "session-uuid-123";
  const testMeetingNo = "123456789";

  const mockMentoringSession = {
    id: testSessionId,
    meetingId: testMeetingId,
    studentId: "student-uuid-123",
    mentorId: "mentor-uuid-123",
    status: MentoringSessionStatus.SCHEDULED,
    serviceDuration: null,
    feedback: null,
    rating: null,
    topic: "JavaScript Fundamentals",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const mockMentoringService = {
      findByMeetingId: jest.fn(),
      completeSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentoringEventListener,
        {
          provide: MentoringService,
          useValue: mockMentoringService,
        },
      ],
    }).compile();

    listener = module.get<MentoringEventListener>(MentoringEventListener);
    mentoringService = module.get(MentoringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleMeetingCompletion", () => {
    it("should complete mentoring session when found", async () => {
      const event = new MeetingLifecycleCompletedEvent(
        testMeetingId,
        testMeetingNo,
        "feishu",
        new Date("2025-11-20T10:00:00Z"),
        3600, // 1 hour
        null,
        new Date("2025-11-20T11:00:00Z"),
        [],
      );

      const completedSession = {
        ...mockMentoringSession,
        status: MentoringSessionStatus.COMPLETED,
        serviceDuration: 3600,
      };

      mentoringService.findByMeetingId.mockResolvedValue(mockMentoringSession);
      mentoringService.completeSession.mockResolvedValue(completedSession);

      await listener.handleMeetingCompletion(event);

      expect(mentoringService.findByMeetingId).toHaveBeenCalledWith(
        testMeetingId,
      );
      expect(mentoringService.completeSession).toHaveBeenCalledWith(
        testSessionId,
        event,
      );
    });

    it("should ignore event when no mentoring session found", async () => {
      const event = new MeetingLifecycleCompletedEvent(
        testMeetingId,
        testMeetingNo,
        "feishu",
        new Date(),
        3600,
        null,
        new Date(),
        [],
      );

      mentoringService.findByMeetingId.mockResolvedValue(null);

      await listener.handleMeetingCompletion(event);

      expect(mentoringService.findByMeetingId).toHaveBeenCalledWith(
        testMeetingId,
      );
      expect(mentoringService.completeSession).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully without throwing", async () => {
      const event = new MeetingLifecycleCompletedEvent(
        testMeetingId,
        testMeetingNo,
        "feishu",
        new Date(),
        3600,
        null,
        new Date(),
        [],
      );

      mentoringService.findByMeetingId.mockRejectedValue(
        new Error("Database error"),
      );

      // Should not throw error
      await expect(
        listener.handleMeetingCompletion(event),
      ).resolves.not.toThrow();

      expect(mentoringService.completeSession).not.toHaveBeenCalled();
    });

    it("should handle completion error gracefully", async () => {
      const event = new MeetingLifecycleCompletedEvent(
        testMeetingId,
        testMeetingNo,
        "feishu",
        new Date(),
        3600,
        null,
        new Date(),
        [],
      );

      mentoringService.findByMeetingId.mockResolvedValue(mockMentoringSession);
      mentoringService.completeSession.mockRejectedValue(
        new Error("Completion failed"),
      );

      // Should not throw error
      await expect(
        listener.handleMeetingCompletion(event),
      ).resolves.not.toThrow();
    });
  });

  describe("handleRecordingReady", () => {
    it("should handle recording ready event when mentoring session found", async () => {
      const event = {
        meetingId: testMeetingId,
        meetingNo: testMeetingNo,
        recordingUrl: "https://example.com/recording.mp4",
        readyAt: new Date(),
      };

      mentoringService.findByMeetingId.mockResolvedValue(mockMentoringSession);

      await listener.handleRecordingReady(event);

      expect(mentoringService.findByMeetingId).toHaveBeenCalledWith(
        testMeetingId,
      );
      // TODO: Assert on recording update logic when implemented
    });

    it("should ignore event when no mentoring session found", async () => {
      const event = {
        meetingId: testMeetingId,
        meetingNo: testMeetingNo,
        recordingUrl: "https://example.com/recording.mp4",
        readyAt: new Date(),
      };

      mentoringService.findByMeetingId.mockResolvedValue(null);

      await listener.handleRecordingReady(event);

      expect(mentoringService.findByMeetingId).toHaveBeenCalledWith(
        testMeetingId,
      );
    });

    it("should handle errors gracefully without throwing", async () => {
      const event = {
        meetingId: testMeetingId,
        meetingNo: testMeetingNo,
        recordingUrl: "https://example.com/recording.mp4",
        readyAt: new Date(),
      };

      mentoringService.findByMeetingId.mockRejectedValue(
        new Error("Database error"),
      );

      // Should not throw error
      await expect(listener.handleRecordingReady(event)).resolves.not.toThrow();
    });
  });
});

