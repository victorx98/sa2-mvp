import { Test, TestingModule } from "@nestjs/testing";
import { SessionDurationCalculator } from "./session-duration-calculator";
import { SessionEventRepository } from "../repositories/session-event.repository";
import { SessionService } from "./session.service";

describe("SessionDurationCalculator", () => {
  let service: SessionDurationCalculator;
  let mockSessionEventRepository: jest.Mocked<SessionEventRepository>;
  let mockSessionService: jest.Mocked<SessionService>;

  const mockSession = {
    id: "00000000-0000-0000-0000-000000000001",
    studentId: "00000000-0000-0000-0000-000000000002",
    mentorId: "00000000-0000-0000-0000-000000000003",
  };

  beforeEach(async () => {
    mockSessionEventRepository = {
      findJoinLeaveEvents: jest.fn(),
    } as any;

    mockSessionService = {
      getSessionById: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionDurationCalculator,
        {
          provide: SessionEventRepository,
          useValue: mockSessionEventRepository,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    service = module.get<SessionDurationCalculator>(SessionDurationCalculator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateDurations", () => {
    it("should calculate durations when mentor and student join once", async () => {
      const baseTime = new Date("2025-11-06T10:00:00Z");

      const events = [
        {
          eventType: "vc.meeting.join_meeting_v1",
          eventData: { user: { id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime()), // 10:00:00
        },
        {
          eventType: "vc.meeting.join_meeting_v1",
          eventData: { user: { id: mockSession.studentId } },
          occurredAt: new Date(baseTime.getTime() + 5 * 60 * 1000), // 10:05:00
        },
        {
          eventType: "vc.meeting.leave_meeting_v1",
          eventData: { user: { id: mockSession.studentId } },
          occurredAt: new Date(baseTime.getTime() + 50 * 60 * 1000), // 10:50:00
        },
        {
          eventType: "vc.meeting.leave_meeting_v1",
          eventData: { user: { id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime() + 60 * 60 * 1000), // 11:00:00
        },
      ];

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      mockSessionEventRepository.findJoinLeaveEvents.mockResolvedValue(
        events as any,
      );

      const result = await service.calculateDurations(mockSession.id);

      // Mentor: 10:00-11:00 = 60 minutes = 3600 seconds
      expect(result.mentorTotalDurationSeconds).toBe(3600);
      // Student: 10:05-10:50 = 45 minutes = 2700 seconds
      expect(result.studentTotalDurationSeconds).toBe(2700);
      // Overlap: 10:05-10:50 = 45 minutes = 2700 seconds
      expect(result.effectiveTutoringDurationSeconds).toBe(2700);
      // Join counts
      expect(result.mentorJoinCount).toBe(1);
      expect(result.studentJoinCount).toBe(1);
    });

    it("should calculate durations when mentor joins late", async () => {
      const baseTime = new Date("2025-11-06T10:00:00Z");

      const events = [
        {
          eventType: "vc.meeting.join_meeting_v1",
          eventData: { user: { id: mockSession.studentId } },
          occurredAt: new Date(baseTime.getTime()), // 10:00:00
        },
        {
          eventType: "vc.meeting.join_meeting_v1",
          eventData: { user: { id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime() + 10 * 60 * 1000), // 10:10:00
        },
        {
          eventType: "vc.meeting.leave_meeting_v1",
          eventData: { user: { id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime() + 50 * 60 * 1000), // 10:50:00
        },
        {
          eventType: "vc.meeting.leave_meeting_v1",
          eventData: { user: { id: mockSession.studentId } },
          occurredAt: new Date(baseTime.getTime() + 60 * 60 * 1000), // 11:00:00
        },
      ];

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      mockSessionEventRepository.findJoinLeaveEvents.mockResolvedValue(
        events as any,
      );

      const result = await service.calculateDurations(mockSession.id);

      // Mentor: 10:10-10:50 = 40 minutes = 2400 seconds
      expect(result.mentorTotalDurationSeconds).toBe(2400);
      // Student: 10:00-11:00 = 60 minutes = 3600 seconds
      expect(result.studentTotalDurationSeconds).toBe(3600);
      // Overlap: 10:10-10:50 = 40 minutes = 2400 seconds
      expect(result.effectiveTutoringDurationSeconds).toBe(2400);
    });

    it("should handle multiple join/leave events (rejoins)", async () => {
      const baseTime = new Date("2025-11-06T10:00:00Z");

      const events = [
        // Mentor first session
        {
          eventType: "vc.meeting.join_meeting_v1",
          eventData: { user: { id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime()), // 10:00:00
        },
        // Student first session
        {
          eventType: "vc.meeting.join_meeting_v1",
          eventData: { user: { id: mockSession.studentId } },
          occurredAt: new Date(baseTime.getTime() + 5 * 60 * 1000), // 10:05:00
        },
        // Mentor leaves temporarily
        {
          eventType: "vc.meeting.leave_meeting_v1",
          eventData: { user: { id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime() + 30 * 60 * 1000), // 10:30:00
        },
        // Mentor rejoins
        {
          eventType: "vc.meeting.join_meeting_v1",
          eventData: { user: { id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime() + 35 * 60 * 1000), // 10:35:00
        },
        // Student leaves
        {
          eventType: "vc.meeting.leave_meeting_v1",
          eventData: { user: { id: mockSession.studentId } },
          occurredAt: new Date(baseTime.getTime() + 50 * 60 * 1000), // 10:50:00
        },
        // Mentor leaves
        {
          eventType: "vc.meeting.leave_meeting_v1",
          eventData: { user: { id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime() + 60 * 60 * 1000), // 11:00:00
        },
      ];

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      mockSessionEventRepository.findJoinLeaveEvents.mockResolvedValue(
        events as any,
      );

      const result = await service.calculateDurations(mockSession.id);

      // Mentor: (10:00-10:30) + (10:35-11:00) = 30 + 25 = 55 minutes = 3300 seconds
      expect(result.mentorTotalDurationSeconds).toBe(3300);
      // Student: 10:05-10:50 = 45 minutes = 2700 seconds
      expect(result.studentTotalDurationSeconds).toBe(2700);
      // Overlap: (10:05-10:30) + (10:35-10:50) = 25 + 15 = 40 minutes = 2400 seconds
      expect(result.effectiveTutoringDurationSeconds).toBe(2400);
      // Join counts
      expect(result.mentorJoinCount).toBe(2);
      expect(result.studentJoinCount).toBe(1);
    });

    it("should handle no overlap when mentor and student never meet", async () => {
      const baseTime = new Date("2025-11-06T10:00:00Z");

      const events = [
        {
          eventType: "vc.meeting.join_meeting_v1",
          eventData: { user: { id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime()), // 10:00:00
        },
        {
          eventType: "vc.meeting.leave_meeting_v1",
          eventData: { user: { id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime() + 30 * 60 * 1000), // 10:30:00
        },
        {
          eventType: "vc.meeting.join_meeting_v1",
          eventData: { user: { id: mockSession.studentId } },
          occurredAt: new Date(baseTime.getTime() + 35 * 60 * 1000), // 10:35:00
        },
        {
          eventType: "vc.meeting.leave_meeting_v1",
          eventData: { user: { id: mockSession.studentId } },
          occurredAt: new Date(baseTime.getTime() + 60 * 60 * 1000), // 11:00:00
        },
      ];

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      mockSessionEventRepository.findJoinLeaveEvents.mockResolvedValue(
        events as any,
      );

      const result = await service.calculateDurations(mockSession.id);

      // Mentor: 10:00-10:30 = 30 minutes = 1800 seconds
      expect(result.mentorTotalDurationSeconds).toBe(1800);
      // Student: 10:35-11:00 = 25 minutes = 1500 seconds
      expect(result.studentTotalDurationSeconds).toBe(1500);
      // No overlap
      expect(result.effectiveTutoringDurationSeconds).toBe(0);
    });

    it("should handle empty events array", async () => {
      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      mockSessionEventRepository.findJoinLeaveEvents.mockResolvedValue([]);

      const result = await service.calculateDurations(mockSession.id);

      expect(result.mentorTotalDurationSeconds).toBe(0);
      expect(result.studentTotalDurationSeconds).toBe(0);
      expect(result.effectiveTutoringDurationSeconds).toBe(0);
      expect(result.mentorJoinCount).toBe(0);
      expect(result.studentJoinCount).toBe(0);
    });

    // Note: Testing "user still in meeting" scenario is skipped because it requires
    // mocking Date.now() which is complex in Jest. This edge case is better tested
    // through integration tests where we can control time more reliably.

    it("should throw error when session not found", async () => {
      mockSessionService.getSessionById.mockResolvedValue(null);

      await expect(
        service.calculateDurations("non-existent-id"),
      ).rejects.toThrow("Session not found");
    });

    it("should handle Zoom event types", async () => {
      const baseTime = new Date("2025-11-06T10:00:00Z");

      const events = [
        {
          eventType: "meeting.participant_joined",
          eventData: { participant: { user_id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime()),
        },
        {
          eventType: "meeting.participant_joined",
          eventData: { participant: { user_id: mockSession.studentId } },
          occurredAt: new Date(baseTime.getTime() + 5 * 60 * 1000),
        },
        {
          eventType: "meeting.participant_left",
          eventData: { participant: { user_id: mockSession.studentId } },
          occurredAt: new Date(baseTime.getTime() + 50 * 60 * 1000),
        },
        {
          eventType: "meeting.participant_left",
          eventData: { participant: { user_id: mockSession.mentorId } },
          occurredAt: new Date(baseTime.getTime() + 60 * 60 * 1000),
        },
      ];

      mockSessionService.getSessionById.mockResolvedValue(mockSession as any);
      mockSessionEventRepository.findJoinLeaveEvents.mockResolvedValue(
        events as any,
      );

      const result = await service.calculateDurations(mockSession.id);

      expect(result.mentorTotalDurationSeconds).toBe(3600);
      expect(result.studentTotalDurationSeconds).toBe(2700);
      expect(result.effectiveTutoringDurationSeconds).toBe(2700);
    });
  });
});
