import { Test, TestingModule } from "@nestjs/testing";
import { SessionService } from "../services/session.service";
import { CreateSessionDto } from "../dto/create-session.dto";
import { SessionException } from "../exceptions/session.exception";
import { MeetingProvider } from "../interfaces/session.interface";

describe("SessionService", () => {
  let service: SessionService;
  let mockDb: any;

  beforeEach(async () => {
    // Mock database connection
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: "DATABASE_CONNECTION",
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  describe("createSession", () => {
    it("should create session record with meeting information", async () => {
      const sessionId = "123e4567-e89b-12d3-a456-426614174000";
      const studentId = "223e4567-e89b-12d3-a456-426614174000";
      const mentorId = "323e4567-e89b-12d3-a456-426614174000";
      const meetingNo = "123456789";

      const dto: CreateSessionDto = {
        studentId,
        mentorId,
        scheduledStartTime: new Date(Date.now() + 86400000).toISOString(),
        scheduledDuration: 60,
        sessionName: "Test Session",
        meetingProvider: MeetingProvider.FEISHU,
        meetingNo,
        meetingUrl: "https://vc.feishu.cn/j/123456789",
      };

      const mockSession = {
        id: sessionId,
        studentId,
        mentorId,
        contractId: null,
        meetingProvider: MeetingProvider.FEISHU,
        meetingNo,
        meetingUrl: "https://vc.feishu.cn/j/123456789",
        meetingPassword: null,
        scheduledStartTime: new Date(dto.scheduledStartTime),
        scheduledDuration: 60,
        actualStartTime: null,
        actualEndTime: null,
        recordings: [],
        aiSummary: null,
        mentorTotalDurationSeconds: null,
        studentTotalDurationSeconds: null,
        effectiveTutoringDurationSeconds: null,
        mentorJoinCount: 0,
        studentJoinCount: 0,
        sessionName: "Test Session",
        notes: null,
        status: "scheduled",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockDb.insert().values().returning.mockResolvedValueOnce([mockSession]);

      const result = await service.createSession(dto);

      expect(result).toBeDefined();
      expect(result.studentId).toBe(studentId);
      expect(result.mentorId).toBe(mentorId);
      expect(result.meetingNo).toBe(meetingNo);
      expect(result.status).toBe("scheduled");
    });

    it("should throw error for invalid start time", async () => {
      const dto: CreateSessionDto = {
        studentId: "223e4567-e89b-12d3-a456-426614174000",
        mentorId: "323e4567-e89b-12d3-a456-426614174000",
        scheduledStartTime: new Date(Date.now() - 1000).toISOString(), // Past time
        scheduledDuration: 60,
      };

      await expect(service.createSession(dto)).rejects.toThrow(
        SessionException,
      );
    });

    it("should throw error for invalid duration", async () => {
      const dto: CreateSessionDto = {
        studentId: "223e4567-e89b-12d3-a456-426614174000",
        mentorId: "323e4567-e89b-12d3-a456-426614174000",
        scheduledStartTime: new Date(Date.now() + 86400000).toISOString(),
        scheduledDuration: 20, // Less than 30 minutes
      };

      await expect(service.createSession(dto)).rejects.toThrow(
        SessionException,
      );
    });

    it("should throw error when student and mentor are the same", async () => {
      const userId = "223e4567-e89b-12d3-a456-426614174000";

      const dto: CreateSessionDto = {
        studentId: userId,
        mentorId: userId,
        scheduledStartTime: new Date(Date.now() + 86400000).toISOString(),
        scheduledDuration: 60,
      };

      await expect(service.createSession(dto)).rejects.toThrow(
        SessionException,
      );
    });

    it("should integrate meeting information from MeetingProvider", async () => {
      const dto: CreateSessionDto = {
        studentId: "223e4567-e89b-12d3-a456-426614174000",
        mentorId: "323e4567-e89b-12d3-a456-426614174000",
        scheduledStartTime: new Date(Date.now() + 86400000).toISOString(),
        scheduledDuration: 60,
        // Meeting information from MeetingProvider.createMeeting()
        meetingProvider: MeetingProvider.FEISHU,
        meetingNo: "235812466",
        meetingUrl: "https://vc.feishu.cn/j/235812466",
        meetingPassword: null,
      };

      const mockSession = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        studentId: dto.studentId,
        mentorId: dto.mentorId,
        contractId: null,
        meetingProvider: dto.meetingProvider,
        meetingNo: dto.meetingNo,
        meetingUrl: dto.meetingUrl,
        meetingPassword: dto.meetingPassword,
        scheduledStartTime: new Date(dto.scheduledStartTime),
        scheduledDuration: 60,
        actualStartTime: null,
        actualEndTime: null,
        recordings: [],
        aiSummary: null,
        mentorTotalDurationSeconds: null,
        studentTotalDurationSeconds: null,
        effectiveTutoringDurationSeconds: null,
        mentorJoinCount: 0,
        studentJoinCount: 0,
        sessionName: expect.any(String),
        notes: null,
        status: "scheduled",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockDb.insert().values().returning.mockResolvedValueOnce([mockSession]);

      const result = await service.createSession(dto);

      expect(result.meetingNo).toBe(dto.meetingNo);
      expect(result.meetingUrl).toBe(dto.meetingUrl);
    });
  });

});

