import { Test, TestingModule } from "@nestjs/testing";
import { SessionEventSubscriber } from "./session-event.subscriber";
import { SessionService } from "../services/session.service";
import { SessionRecordingManager } from "../recording/session-recording-manager";
import { MeetingEventCreated } from "@core/webhook/dto/meeting-event-created.event";
import { SessionStatus } from "../interfaces/session.interface";

describe("SessionEventSubscriber", () => {
  let subscriber: SessionEventSubscriber;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockRecordingManager: jest.Mocked<SessionRecordingManager>;

  beforeEach(async () => {
    mockSessionService = {
      getSessionByMeetingNo: jest.fn(),
      updateSession: jest.fn(),
    } as any;

    mockRecordingManager = {
      appendRecording: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionEventSubscriber,
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: SessionRecordingManager,
          useValue: mockRecordingManager,
        },
      ],
    }).compile();

    subscriber = module.get<SessionEventSubscriber>(SessionEventSubscriber);
  });

  describe("handleMeetingEvent", () => {
    it("should ignore events without meeting_no (Zoom events)", async () => {
      const event = new MeetingEventCreated(
        "zoom_meeting_id",
        null, // meetingNo is null for Zoom
        "event_zoom_001",
        "meeting.started",
        "zoom",
        "host_123",
        1,
        "Zoom Meeting",
        new Date(),
        {}
      );

      await subscriber.handleMeetingEvent(event);

      // Should not query session for Zoom events without meeting_no
      expect(mockSessionService.getSessionByMeetingNo).not.toHaveBeenCalled();
    });

    it("should ignore events when session not found (not a session meeting)", async () => {
      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "999999999", // Non-existent meeting_no
        "event_feishu_001",
        "vc.meeting.join_meeting_v1",
        "feishu",
        "operator_123",
        2,
        "Some Meeting",
        new Date(),
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(null);

      await subscriber.handleMeetingEvent(event);

      expect(mockSessionService.getSessionByMeetingNo).toHaveBeenCalledWith(
        "999999999"
      );
      expect(mockSessionService.updateSession).not.toHaveBeenCalled();
    });

    it("should handle meeting_started event by updating actual_start_time and status", async () => {
      const sessionId = "session_123";
      const occurredAt = new Date();

      const mockSession = {
        id: sessionId,
        studentId: "student_1",
        mentorId: "mentor_1",
        status: SessionStatus.SCHEDULED,
        scheduledStartTime: new Date(),
        scheduledDuration: 60,
      };

      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "123456789",
        "event_start",
        "vc.meeting.meeting_started_v1",
        "feishu",
        "operator_123",
        1,
        "Test Meeting",
        occurredAt,
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);
      mockSessionService.updateSession.mockResolvedValue(mockSession as any);

      await subscriber.handleMeetingEvent(event);

      expect(mockSessionService.getSessionByMeetingNo).toHaveBeenCalledWith(
        "123456789"
      );
      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          status: SessionStatus.STARTED,
        })
      );
    });

    it("should handle meeting_ended event by updating actual_end_time and status", async () => {
      const sessionId = "session_456";
      const occurredAt = new Date();

      const mockSession = {
        id: sessionId,
        studentId: "student_2",
        mentorId: "mentor_2",
        status: SessionStatus.STARTED,
      };

      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "456789123",
        "event_end",
        "vc.meeting.meeting_ended_v1",
        "feishu",
        null,
        null,
        null,
        occurredAt,
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);
      mockSessionService.updateSession.mockResolvedValue(mockSession as any);

      await subscriber.handleMeetingEvent(event);

      expect(mockSessionService.updateSession).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          status: SessionStatus.COMPLETED,
        })
      );
    });

    it("should handle recording_ready event by appending recording", async () => {
      const sessionId = "session_789";
      const meetingId = "feishu_meeting_id_rec";
      const recordingData = {
        recordingId: "rec_001",
        recordingUrl: "https://example.com/recording/001",
        duration: 3600,
        transcriptUrl: null,
        startedAt: new Date(),
        endedAt: new Date(),
      };

      const mockSession = {
        id: sessionId,
        studentId: "student_3",
        mentorId: "mentor_3",
        status: SessionStatus.COMPLETED,
      };

      const event = new MeetingEventCreated(
        meetingId,
        "789123456",
        "event_rec_ready",
        "vc.meeting.recording_ready_v1",
        "feishu",
        null,
        null,
        null,
        new Date(),
        {
          recording: {
            id: "rec_001",
            url: "https://example.com/recording/001",
            duration: 3600,
          },
        }
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);
      mockRecordingManager.appendRecording.mockResolvedValue([
        recordingData as any,
      ]);

      await subscriber.handleMeetingEvent(event);

      expect(mockRecordingManager.appendRecording).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          recordingId: "rec_001",
          recordingUrl: "https://example.com/recording/001",
        })
      );
    });

    it("should handle join_meeting event by recording participant join", async () => {
      const sessionId = "session_join";
      const operatorId = "participant_123";

      const mockSession = {
        id: sessionId,
        studentId: operatorId,
        mentorId: "mentor_4",
      };

      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "111222333",
        "event_join",
        "vc.meeting.join_meeting_v1",
        "feishu",
        operatorId,
        2, // participant
        null,
        new Date(),
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);

      await subscriber.handleMeetingEvent(event);

      // Join event should be recorded (handled via storeGenericEvent)
      expect(mockSessionService.getSessionByMeetingNo).toHaveBeenCalled();
    });

    it("should handle leave_meeting event by recording participant leave", async () => {
      const sessionId = "session_leave";
      const operatorId = "participant_456";

      const mockSession = {
        id: sessionId,
        studentId: "student_5",
        mentorId: operatorId,
      };

      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "444555666",
        "event_leave",
        "vc.meeting.leave_meeting_v1",
        "feishu",
        operatorId,
        1,
        null,
        new Date(),
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);

      await subscriber.handleMeetingEvent(event);

      expect(mockSessionService.getSessionByMeetingNo).toHaveBeenCalled();
    });

    it("should handle recording_started event", async () => {
      const sessionId = "session_rec_start";

      const mockSession = {
        id: sessionId,
        studentId: "student_6",
        mentorId: "mentor_6",
      };

      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "777888999",
        "event_rec_start",
        "vc.meeting.recording_started_v1",
        "feishu",
        "mentor_6",
        1,
        null,
        new Date(),
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);

      await subscriber.handleMeetingEvent(event);

      expect(mockSessionService.getSessionByMeetingNo).toHaveBeenCalled();
    });

    it("should handle recording_ended event", async () => {
      const sessionId = "session_rec_end";

      const mockSession = {
        id: sessionId,
        studentId: "student_7",
        mentorId: "mentor_7",
      };

      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "101112131",
        "event_rec_end",
        "vc.meeting.recording_ended_v1",
        "feishu",
        null,
        null,
        null,
        new Date(),
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);

      await subscriber.handleMeetingEvent(event);

      expect(mockSessionService.getSessionByMeetingNo).toHaveBeenCalled();
    });

    it("should handle share_started event", async () => {
      const sessionId = "session_share_start";

      const mockSession = {
        id: sessionId,
        studentId: "student_8",
        mentorId: "mentor_8",
      };

      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "141516171",
        "event_share_start",
        "vc.meeting.share_started_v1",
        "feishu",
        "mentor_8",
        1,
        null,
        new Date(),
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);

      await subscriber.handleMeetingEvent(event);

      expect(mockSessionService.getSessionByMeetingNo).toHaveBeenCalled();
    });

    it("should handle share_ended event", async () => {
      const sessionId = "session_share_end";

      const mockSession = {
        id: sessionId,
        studentId: "student_9",
        mentorId: "mentor_9",
      };

      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "181920212",
        "event_share_end",
        "vc.meeting.share_ended_v1",
        "feishu",
        "mentor_9",
        1,
        null,
        new Date(),
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);

      await subscriber.handleMeetingEvent(event);

      expect(mockSessionService.getSessionByMeetingNo).toHaveBeenCalled();
    });

    it("should handle Zoom meeting.started event", async () => {
      const sessionId = "session_zoom_start";

      const mockSession = {
        id: sessionId,
        studentId: "student_zoom",
        mentorId: "mentor_zoom",
      };

      // For Zoom events with meeting_no, should still process
      const event = new MeetingEventCreated(
        "zoom_meeting_id",
        "zoom_meeting_no", // Some systems might have this
        "event_zoom_start",
        "meeting.started",
        "zoom",
        "host_zoom",
        null,
        "Zoom Meeting",
        new Date(),
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);
      mockSessionService.updateSession.mockResolvedValue(mockSession as any);

      await subscriber.handleMeetingEvent(event);

      expect(mockSessionService.updateSession).toHaveBeenCalled();
    });

    it("should handle errors gracefully without throwing", async () => {
      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "error_meeting",
        "event_error",
        "vc.meeting.join_meeting_v1",
        "feishu",
        null,
        null,
        null,
        new Date(),
        {}
      );

      const mockSession = {
        id: "session_error",
        studentId: "student_error",
        mentorId: "mentor_error",
      };

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);
      mockSessionService.updateSession.mockRejectedValue(
        new Error("Database error")
      );

      // Should not throw, error should be logged
      await expect(
        subscriber.handleMeetingEvent(event)
      ).resolves.not.toThrow();
    });
  });

  describe("event type routing", () => {
    it("should route Feishu events correctly", async () => {
      const feishuEventTypes = [
        "vc.meeting.meeting_started_v1",
        "vc.meeting.meeting_ended_v1",
        "vc.meeting.recording_ready_v1",
        "vc.meeting.join_meeting_v1",
        "vc.meeting.leave_meeting_v1",
        "vc.meeting.recording_started_v1",
        "vc.meeting.recording_ended_v1",
        "vc.meeting.share_started_v1",
        "vc.meeting.share_ended_v1",
      ];

      const mockSession = {
        id: "session_route",
        studentId: "student_route",
        mentorId: "mentor_route",
      };

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);

      for (const eventType of feishuEventTypes) {
        const event = new MeetingEventCreated(
          "feishu_meeting_id",
          "route_meeting",
          `event_${eventType}`,
          eventType,
          "feishu",
          null,
          null,
          null,
          new Date(),
          {}
        );

        await subscriber.handleMeetingEvent(event);

        expect(mockSessionService.getSessionByMeetingNo).toHaveBeenCalled();
      }
    });

    it("should handle unrecognized event types gracefully", async () => {
      const mockSession = {
        id: "session_unknown",
        studentId: "student_unknown",
        mentorId: "mentor_unknown",
      };

      const event = new MeetingEventCreated(
        "feishu_meeting_id",
        "unknown_meeting",
        "event_unknown",
        "vc.unknown.event_type_v1", // Unrecognized
        "feishu",
        null,
        null,
        null,
        new Date(),
        {}
      );

      mockSessionService.getSessionByMeetingNo.mockResolvedValue(mockSession as any);

      // Should handle gracefully
      await expect(
        subscriber.handleMeetingEvent(event)
      ).resolves.not.toThrow();
    });
  });
});

