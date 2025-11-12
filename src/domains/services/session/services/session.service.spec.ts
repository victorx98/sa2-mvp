import { Test, TestingModule } from "@nestjs/testing";
import { SessionService } from "./session.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  SessionException,
  SessionNotFoundException,
} from "../exceptions/session.exception";
import { CreateSessionDto } from "../dto/create-session.dto";
import { UpdateSessionDto } from "../dto/update-session.dto";
import { MeetingInfoDto } from "../dto/meeting-info.dto";
import {
  SessionStatus,
  MeetingProvider,
} from "../interfaces/session.interface";

describe("SessionService", () => {
  let service: SessionService;
  let mockDb: any;

  // Mock database connection
  const createMockDb = () => ({
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  });

  beforeEach(async () => {
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createSession", () => {
    const validDto: CreateSessionDto = {
      studentId: "00000000-0000-0000-0000-000000000001",
      mentorId: "00000000-0000-0000-0000-000000000002",
      scheduledStartTime: new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString(), // Tomorrow
      scheduledDuration: 60,
      sessionName: "Test Session",
      meetingProvider: MeetingProvider.FEISHU,
    };

    it("should create session with valid data", async () => {
      const mockSession = {
        id: "00000000-0000-0000-0000-000000000003",
        ...validDto,
        scheduledStartTime: new Date(validDto.scheduledStartTime),
        status: "scheduled",
        recordings: [],
        aiSummary: null,
        mentorJoinCount: 0,
        studentJoinCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        meetingId: null,
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

      mockDb.returning.mockResolvedValue([mockSession]);

      const result = await service.createSession(validDto);

      expect(result).toBeDefined();
      expect(result.studentId).toBe(validDto.studentId);
      expect(result.mentorId).toBe(validDto.mentorId);
      expect(result.status).toBe(SessionStatus.SCHEDULED);
    });

    it("should throw error when scheduledStartTime is in past", async () => {
      const invalidDto = {
        ...validDto,
        scheduledStartTime: new Date(Date.now() - 1000).toISOString(), // Past time
      };

      await expect(service.createSession(invalidDto)).rejects.toThrow(
        SessionException,
      );
    });

    it("should throw error when duration < 30", async () => {
      const invalidDto = {
        ...validDto,
        scheduledDuration: 20,
      };

      await expect(service.createSession(invalidDto)).rejects.toThrow(
        SessionException,
      );
    });

    it("should throw error when duration > 180", async () => {
      const invalidDto = {
        ...validDto,
        scheduledDuration: 200,
      };

      await expect(service.createSession(invalidDto)).rejects.toThrow(
        SessionException,
      );
    });

    it("should throw error when student and mentor are the same", async () => {
      const invalidDto = {
        ...validDto,
        mentorId: validDto.studentId,
      };

      await expect(service.createSession(invalidDto)).rejects.toThrow(
        SessionException,
      );
    });

    it("should auto-generate session name if not provided", async () => {
      const dtoWithoutName = {
        ...validDto,
        sessionName: undefined,
      };

      const mockSession = {
        id: "00000000-0000-0000-0000-000000000003",
        ...dtoWithoutName,
        sessionName: `Session with mentor ${dtoWithoutName.mentorId.substring(0, 8)}`,
        scheduledStartTime: new Date(dtoWithoutName.scheduledStartTime),
        status: "scheduled",
        recordings: [],
        aiSummary: null,
        mentorJoinCount: 0,
        studentJoinCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        meetingId: null,
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

      mockDb.returning.mockResolvedValue([mockSession]);

      const result = await service.createSession(dtoWithoutName);

      expect(result.sessionName).toContain("Session with mentor");
    });
  });

  describe("updateSession", () => {
    const sessionId = "00000000-0000-0000-0000-000000000003";
    const existingSession = {
      id: sessionId,
      studentId: "00000000-0000-0000-0000-000000000001",
      mentorId: "00000000-0000-0000-0000-000000000002",
      scheduledStartTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      scheduledDuration: 60,
      sessionName: "Test Session",
      status: "scheduled",
      recordings: [],
      aiSummary: null,
      mentorJoinCount: 0,
      studentJoinCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      meetingProvider: "feishu",
      meetingId: null,
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

    it("should update session fields", async () => {
      const updateDto: UpdateSessionDto = {
        sessionName: "Updated Session Name",
        notes: "Some notes",
      };

      // Mock getSessionById
      mockDb.limit.mockResolvedValueOnce([existingSession]);

      // Mock update
      const updatedSession = {
        ...existingSession,
        ...updateDto,
      };
      mockDb.returning.mockResolvedValue([updatedSession]);

      const result = await service.updateSession(sessionId, updateDto);

      expect(result.sessionName).toBe(updateDto.sessionName);
      expect(result.notes).toBe(updateDto.notes);
    });

    it("should throw error when session not found", async () => {
      mockDb.limit.mockResolvedValueOnce([]); // No session found

      await expect(
        service.updateSession(sessionId, { sessionName: "Test" }),
      ).rejects.toThrow(SessionNotFoundException);
    });

    it("should throw error when trying to update completed session", async () => {
      const completedSession = {
        ...existingSession,
        status: SessionStatus.COMPLETED,
      };

      mockDb.limit.mockResolvedValueOnce([completedSession]);

      await expect(
        service.updateSession(sessionId, { sessionName: "Test" }),
      ).rejects.toThrow(SessionException);
    });

    it("should throw error when new start time is in past", async () => {
      mockDb.limit.mockResolvedValueOnce([existingSession]);

      const updateDto: UpdateSessionDto = {
        scheduledStartTime: new Date(Date.now() - 1000).toISOString(),
      };

      await expect(service.updateSession(sessionId, updateDto)).rejects.toThrow(
        SessionException,
      );
    });
  });

  describe("updateMeetingInfo", () => {
    const sessionId = "00000000-0000-0000-0000-000000000003";
    const existingSession = {
      id: sessionId,
      studentId: "00000000-0000-0000-0000-000000000001",
      mentorId: "00000000-0000-0000-0000-000000000002",
      scheduledStartTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      scheduledDuration: 60,
      sessionName: "Test Session",
      status: "scheduled",
      recordings: [],
      aiSummary: null,
      mentorJoinCount: 0,
      studentJoinCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      meetingProvider: "feishu",
      meetingId: null,
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

    it("should update meeting information", async () => {
      const meetingInfo: MeetingInfoDto = {
        meetingProvider: MeetingProvider.FEISHU,
        meetingId: "6892847362938471942",
        meetingNo: "123456789",
        meetingUrl: "https://vc.feishu.cn/j/123456789",
        meetingPassword: "abc123",
      };

      // Mock getSessionById
      mockDb.limit.mockResolvedValueOnce([existingSession]);

      // Mock update
      const updatedSession = {
        ...existingSession,
        ...meetingInfo,
      };
      mockDb.returning.mockResolvedValue([updatedSession]);

      const result = await service.updateMeetingInfo(sessionId, meetingInfo);

      expect(result.meetingId).toBe(meetingInfo.meetingId);
      expect(result.meetingUrl).toBe(meetingInfo.meetingUrl);
    });

    it("should throw error when session not found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      const meetingInfo: MeetingInfoDto = {
        meetingProvider: MeetingProvider.FEISHU,
        meetingId: "123",
        meetingUrl: "https://example.com",
      };

      await expect(
        service.updateMeetingInfo(sessionId, meetingInfo),
      ).rejects.toThrow(SessionNotFoundException);
    });
  });

  describe("cancelSession", () => {
    const sessionId = "00000000-0000-0000-0000-000000000003";
    const existingSession = {
      id: sessionId,
      studentId: "00000000-0000-0000-0000-000000000001",
      mentorId: "00000000-0000-0000-0000-000000000002",
      scheduledStartTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      scheduledDuration: 60,
      sessionName: "Test Session",
      status: "scheduled",
      recordings: [],
      aiSummary: null,
      mentorJoinCount: 0,
      studentJoinCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      meetingProvider: "feishu",
      meetingId: null,
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

    it("should cancel session with reason", async () => {
      const cancelReason = "Student requested cancellation";

      // Mock getSessionById
      mockDb.limit.mockResolvedValueOnce([existingSession]);

      // Mock update
      const cancelledSession = {
        ...existingSession,
        status: SessionStatus.CANCELLED,
        notes: `[Cancelled] ${cancelReason}`,
      };
      mockDb.returning.mockResolvedValue([cancelledSession]);

      const result = await service.cancelSession(sessionId, cancelReason);

      expect(result.status).toBe(SessionStatus.CANCELLED);
      expect(result.notes).toContain(cancelReason);
    });

    it("should throw error when cancel reason is empty", async () => {
      mockDb.limit.mockResolvedValueOnce([existingSession]);

      await expect(service.cancelSession(sessionId, "")).rejects.toThrow(
        SessionException,
      );
    });

    it("should throw error when session is already cancelled", async () => {
      const cancelledSession = {
        ...existingSession,
        status: SessionStatus.CANCELLED,
      };

      mockDb.limit.mockResolvedValueOnce([cancelledSession]);

      await expect(
        service.cancelSession(sessionId, "Some reason"),
      ).rejects.toThrow(SessionException);
    });

    it("should throw error when session is completed", async () => {
      const completedSession = {
        ...existingSession,
        status: SessionStatus.COMPLETED,
      };

      mockDb.limit.mockResolvedValueOnce([completedSession]);

      await expect(
        service.cancelSession(sessionId, "Some reason"),
      ).rejects.toThrow(SessionException);
    });
  });

  describe("softDeleteSession", () => {
    const sessionId = "00000000-0000-0000-0000-000000000003";
    const existingSession = {
      id: sessionId,
      studentId: "00000000-0000-0000-0000-000000000001",
      mentorId: "00000000-0000-0000-0000-000000000002",
      scheduledStartTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      scheduledDuration: 60,
      sessionName: "Test Session",
      status: "scheduled",
      recordings: [],
      aiSummary: null,
      mentorJoinCount: 0,
      studentJoinCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      meetingProvider: "feishu",
      meetingId: null,
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

    it("should soft delete session", async () => {
      // Mock getSessionById
      mockDb.limit.mockResolvedValueOnce([existingSession]);

      // Mock update
      const deletedSession = {
        ...existingSession,
        deletedAt: new Date(),
      };
      mockDb.returning.mockResolvedValue([deletedSession]);

      const result = await service.softDeleteSession(sessionId);

      expect(result.deletedAt).toBeDefined();
      expect(result.deletedAt).not.toBeNull();
    });

    it("should throw error when session not found", async () => {
      mockDb.limit.mockResolvedValueOnce([]);

      await expect(service.softDeleteSession(sessionId)).rejects.toThrow(
        SessionNotFoundException,
      );
    });
  });

  describe("getSessionById", () => {
    it("should return session when found", async () => {
      const mockSession = {
        id: "00000000-0000-0000-0000-000000000003",
        studentId: "00000000-0000-0000-0000-000000000001",
        mentorId: "00000000-0000-0000-0000-000000000002",
        scheduledStartTime: new Date(),
        scheduledDuration: 60,
        sessionName: "Test Session",
        status: "scheduled",
        recordings: [],
        aiSummary: null,
        mentorJoinCount: 0,
        studentJoinCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        meetingProvider: "feishu",
        meetingId: null,
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

      mockDb.limit.mockResolvedValue([mockSession]);

      const result = await service.getSessionById(mockSession.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(mockSession.id);
    });

    it("should return null when session not found", async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await service.getSessionById("non-existent-id");

      expect(result).toBeNull();
    });
  });

});
