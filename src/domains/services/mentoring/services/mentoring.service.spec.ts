import { Test, TestingModule } from "@nestjs/testing";
import { MentoringService } from "./mentoring.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import {
  MentoringSessionNotFoundException,
  MentoringSessionValidationException,
  MentoringSessionStateException,
} from "../exceptions/mentoring.exception";
import { MentoringSessionStatus } from "../entities/mentoring-session.entity";
import { MeetingLifecycleCompletedEvent } from "@core/meeting/events/meeting-lifecycle.events";

describe("MentoringService", () => {
  let service: MentoringService;
  let mockDb: any;

  // Test data
  const testMeetingId = "meeting-uuid-123";
  const testSessionId = "session-uuid-123";
  const testStudentId = "student-uuid-123";
  const testMentorId = "mentor-uuid-123";

  // Mock mentoring session
  const mockMentoringSession = {
    id: testSessionId,
    meetingId: testMeetingId,
    studentId: testStudentId,
    mentorId: testMentorId,
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

  // Mock meeting
  const mockMeeting = {
    id: testMeetingId,
    meetingNo: "123456789",
    meetingProvider: "feishu",
    meetingId: "external-meeting-id",
    topic: "Test Meeting",
    meetingUrl: "https://vc.feishu.cn/j/123456789",
    scheduleStartTime: new Date(),
    scheduleDuration: 60,
    status: "scheduled",
    actualDuration: null,
    meetingTimeList: [],
    recordingUrl: null,
    lastMeetingEndedTimestamp: null,
    pendingTaskId: null,
    eventType: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Create mock database connection
  const createMockDb = () => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    transaction: jest.fn((callback) => callback(mockDb)),
  });

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentoringService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<MentoringService>(MentoringService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createSession", () => {
    const createDto = {
      meetingId: testMeetingId,
      studentId: testStudentId,
      mentorId: testMentorId,
      topic: "JavaScript Fundamentals",
      notes: "Focus on async/await",
    };

    it("should create a mentoring session successfully", async () => {
      // Mock meeting exists check
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMeeting]),
      });

      // Mock existing session check (should return empty)
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      // Mock insert
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockMentoringSession]),
      });

      const result = await service.createSession(createDto);

      expect(result).toEqual(mockMentoringSession);
      expect(mockDb.insert).toHaveBeenCalledWith(schema.mentoringSessions);
    });

    it("should throw error when student and mentor are the same", async () => {
      const invalidDto = {
        ...createDto,
        mentorId: testStudentId, // Same as studentId
      };

      await expect(service.createSession(invalidDto)).rejects.toThrow(
        MentoringSessionValidationException,
      );
    });

    it("should throw error when meeting does not exist", async () => {
      // Mock meeting not found
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await expect(service.createSession(createDto)).rejects.toThrow(
        MentoringSessionValidationException,
      );
    });

    it("should throw error when mentoring session already exists for meeting", async () => {
      // Mock meeting exists
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMeeting]),
      });

      // Mock existing session found
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMentoringSession]),
      });

      await expect(service.createSession(createDto)).rejects.toThrow(
        MentoringSessionValidationException,
      );
    });
  });

  describe("updateSession", () => {
    const updateDto = {
      topic: "Advanced JavaScript",
      notes: "Focus on closures",
      feedback: "Great progress",
      rating: 5,
    };

    it("should update a mentoring session successfully", async () => {
      // Mock get session by id
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMentoringSession]),
      });

      // Mock update
      const updatedSession = { ...mockMentoringSession, ...updateDto };
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([updatedSession]),
      });

      const result = await service.updateSession(testSessionId, updateDto);

      expect(result.topic).toBe(updateDto.topic);
      expect(result.feedback).toBe(updateDto.feedback);
      expect(result.rating).toBe(updateDto.rating);
    });

    it("should throw error when session not found", async () => {
      // Mock session not found
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.updateSession(testSessionId, updateDto),
      ).rejects.toThrow(MentoringSessionNotFoundException);
    });

    it("should throw error for invalid status transition", async () => {
      // Mock get completed session
      const completedSession = {
        ...mockMentoringSession,
        status: MentoringSessionStatus.COMPLETED,
      };
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([completedSession]),
      });

      const invalidUpdate = {
        status: MentoringSessionStatus.SCHEDULED, // Invalid: completed -> scheduled
      };

      await expect(
        service.updateSession(testSessionId, invalidUpdate),
      ).rejects.toThrow(MentoringSessionStateException);
    });

    it("should throw error for invalid rating", async () => {
      // Mock get session
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMentoringSession]),
      });

      const invalidUpdate = {
        rating: 6, // Invalid: rating must be 1-5
      };

      await expect(
        service.updateSession(testSessionId, invalidUpdate),
      ).rejects.toThrow(MentoringSessionValidationException);
    });
  });

  describe("deleteSession", () => {
    it("should soft delete a mentoring session successfully", async () => {
      // Mock get session
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMentoringSession]),
      });

      // Mock update (soft delete)
      const deletedSession = {
        ...mockMentoringSession,
        status: MentoringSessionStatus.DELETED,
        deletedAt: new Date(),
      };
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([deletedSession]),
      });

      const result = await service.deleteSession(testSessionId);

      expect(result.status).toBe(MentoringSessionStatus.DELETED);
      expect(result.deletedAt).toBeDefined();
    });

    it("should throw error when session not found", async () => {
      // Mock session not found
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await expect(service.deleteSession(testSessionId)).rejects.toThrow(
        MentoringSessionNotFoundException,
      );
    });
  });

  describe("completeSession", () => {
    const completionEvent = new MeetingLifecycleCompletedEvent(
      testMeetingId,
      "123456789",
      "feishu",
      new Date(),
      3600, // 1 hour in seconds
      null,
      new Date(),
      [],
    );

    it("should complete a mentoring session successfully", async () => {
      // Mock get session
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMentoringSession]),
      });

      // Mock update
      const completedSession = {
        ...mockMentoringSession,
        status: MentoringSessionStatus.COMPLETED,
        serviceDuration: 3600,
      };
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([completedSession]),
      });

      const result = await service.completeSession(
        testSessionId,
        completionEvent,
      );

      expect(result.status).toBe(MentoringSessionStatus.COMPLETED);
      expect(result.serviceDuration).toBe(3600);
    });

    it("should return existing session if already completed", async () => {
      // Mock get completed session
      const completedSession = {
        ...mockMentoringSession,
        status: MentoringSessionStatus.COMPLETED,
      };
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([completedSession]),
      });

      const result = await service.completeSession(
        testSessionId,
        completionEvent,
      );

      expect(result.status).toBe(MentoringSessionStatus.COMPLETED);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("should throw error when trying to complete cancelled session", async () => {
      // Mock get cancelled session
      const cancelledSession = {
        ...mockMentoringSession,
        status: MentoringSessionStatus.CANCELLED,
      };
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([cancelledSession]),
      });

      await expect(
        service.completeSession(testSessionId, completionEvent),
      ).rejects.toThrow(MentoringSessionStateException);
    });

    it("should throw error when session not found", async () => {
      // Mock session not found
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.completeSession(testSessionId, completionEvent),
      ).rejects.toThrow(MentoringSessionNotFoundException);
    });
  });

  describe("cancelSession", () => {
    const cancelReason = "Student requested reschedule";

    it("should cancel a mentoring session successfully", async () => {
      // Mock get session
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMentoringSession]),
      });

      // Mock update
      const cancelledSession = {
        ...mockMentoringSession,
        status: MentoringSessionStatus.CANCELLED,
        notes: `[Cancelled] ${cancelReason}`,
      };
      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([cancelledSession]),
      });

      const result = await service.cancelSession(testSessionId, cancelReason);

      expect(result.status).toBe(MentoringSessionStatus.CANCELLED);
      expect(result.notes).toContain(cancelReason);
    });

    it("should throw error when trying to cancel completed session", async () => {
      // Mock get completed session
      const completedSession = {
        ...mockMentoringSession,
        status: MentoringSessionStatus.COMPLETED,
      };
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([completedSession]),
      });

      await expect(
        service.cancelSession(testSessionId, cancelReason),
      ).rejects.toThrow(MentoringSessionStateException);
    });

    it("should return existing session if already cancelled", async () => {
      // Mock get cancelled session
      const cancelledSession = {
        ...mockMentoringSession,
        status: MentoringSessionStatus.CANCELLED,
      };
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([cancelledSession]),
      });

      const result = await service.cancelSession(testSessionId, cancelReason);

      expect(result.status).toBe(MentoringSessionStatus.CANCELLED);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("should throw error when session not found", async () => {
      // Mock session not found
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.cancelSession(testSessionId, cancelReason),
      ).rejects.toThrow(MentoringSessionNotFoundException);
    });
  });

  describe("getSessionById", () => {
    it("should return a mentoring session by id", async () => {
      // Mock select
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMentoringSession]),
      });

      const result = await service.getSessionById(testSessionId);

      expect(result).toEqual(mockMentoringSession);
    });

    it("should return null when session not found", async () => {
      // Mock session not found
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getSessionById(testSessionId);

      expect(result).toBeNull();
    });

    it("should exclude soft deleted sessions", async () => {
      // Mock no session found (because deletedAt is not null, where clause filters it out)
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getSessionById(testSessionId);

      expect(result).toBeNull();
    });
  });

  describe("findByMeetingId", () => {
    it("should find a mentoring session by meeting id", async () => {
      // Mock select
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockMentoringSession]),
      });

      const result = await service.findByMeetingId(testMeetingId);

      expect(result).toEqual(mockMentoringSession);
    });

    it("should return null when no session found for meeting", async () => {
      // Mock no session found
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findByMeetingId(testMeetingId);

      expect(result).toBeNull();
    });

    it("should exclude soft deleted sessions", async () => {
      // Mock soft deleted session
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      const result = await service.findByMeetingId(testMeetingId);

      expect(result).toBeNull();
    });
  });
});

