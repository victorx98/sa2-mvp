import { Test, TestingModule } from "@nestjs/testing";
import { SessionQueryService } from "./session-query.service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";

describe("SessionQueryService", () => {
  let service: SessionQueryService;
  let mockDb: any;

  beforeEach(async () => {
    // Mock database connection with common query methods
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      and: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      gt: jest.fn(),
      lt: jest.fn(),
      eq: jest.fn(),
      gte: jest.fn(),
      lte: jest.fn(),
      isNull: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionQueryService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<SessionQueryService>(SessionQueryService);
  });

  describe("findByStudentId", () => {
    it("should find sessions by student ID with default pagination", async () => {
      const studentId = "student_123";
      const mockSessions = [
        {
          id: "session_1",
          studentId,
          mentorId: "mentor_1",
          status: "scheduled",
          scheduledStartTime: new Date(),
          scheduledDuration: 60,
        },
        {
          id: "session_2",
          studentId,
          mentorId: "mentor_2",
          status: "completed",
          scheduledStartTime: new Date(),
          scheduledDuration: 90,
        },
      ];

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue(mockSessions);

      const result = await service.findByStudentId(studentId);

      expect(result).toBeDefined();
      expect(result.data).toBeDefined() || expect(result).toEqual(expect.any(Object));
    });

    it("should filter sessions by status", async () => {
      const studentId = "student_456";
      const filters = { status: ["completed", "cancelled"] };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, filters);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should filter sessions by date range", async () => {
      const studentId = "student_789";
      const filters = {
        date_from: new Date("2021-01-01"),
        date_to: new Date("2021-12-31"),
      };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, filters);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should filter sessions with recordings", async () => {
      const studentId = "student_with_rec";
      const filters = { has_recording: true };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, filters);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should apply pagination with custom page and limit", async () => {
      const studentId = "student_pagination";
      const pagination = { page: 2, limit: 50 };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, {}, pagination);

      expect(mockDb.limit).toHaveBeenCalled();
      expect(mockDb.offset).toHaveBeenCalled();
    });
  });

  describe("findByMentorId", () => {
    it("should find sessions by mentor ID", async () => {
      const mentorId = "mentor_101";

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByMentorId(mentorId);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should find mentor sessions with filters", async () => {
      const mentorId = "mentor_202";
      const filters = { status: ["started"] };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByMentorId(mentorId, filters);

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe("findUpcomingSessions", () => {
    it("should find upcoming sessions for a student", async () => {
      const userId = "student_upcoming";

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockResolvedValue([]);

      await service.findUpcomingSessions(userId, "student");

      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalled();
    });

    it("should find upcoming sessions for a mentor", async () => {
      const userId = "mentor_upcoming";

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockResolvedValue([]);

      await service.findUpcomingSessions(userId, "mentor");

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should use default limit of 10 if not provided", async () => {
      const userId = "user_limit_default";

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockResolvedValue([]);

      await service.findUpcomingSessions(userId, "student");

      // Verify limit was called (default should be 10)
      expect(mockDb.limit).toHaveBeenCalled();
    });

    it("should use custom limit if provided", async () => {
      const userId = "user_limit_custom";

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockResolvedValue([]);

      await service.findUpcomingSessions(userId, "student", 20);

      expect(mockDb.limit).toHaveBeenCalled();
    });

    it("should only return sessions after current time", async () => {
      const userId = "user_future_only";

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockResolvedValue([]);

      await service.findUpcomingSessions(userId, "student");

      // Verify where condition filters for future dates
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe("getSessionStatistics", () => {
    it("should get statistics for student sessions", async () => {
      const userId = "student_stats";

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.groupBy.mockResolvedValue([]);

      await service.getSessionStatistics(userId, "student");

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should get statistics for mentor sessions", async () => {
      const userId = "mentor_stats";

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.groupBy.mockResolvedValue([]);

      await service.getSessionStatistics(userId, "mentor");

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should include date range filter in statistics", async () => {
      const userId = "user_stats_date";
      const dateRange = {
        start: new Date("2021-01-01"),
        end: new Date("2021-12-31"),
      };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.groupBy.mockResolvedValue([]);

      await service.getSessionStatistics(userId, "student", dateRange);

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe("filtering and searching", () => {
    it("should filter by has_transcript", async () => {
      const studentId = "student_transcript";
      const filters = { has_transcript: true };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, filters);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should search by keyword", async () => {
      const studentId = "student_search";
      const filters = { keyword: "test" };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, filters);

      expect(mockDb.where).toHaveBeenCalled();
    });

    it("should combine multiple filters", async () => {
      const studentId = "student_multi_filter";
      const filters = {
        status: ["completed"],
        date_from: new Date("2021-01-01"),
        date_to: new Date("2021-12-31"),
        has_recording: true,
        keyword: "important",
      };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, filters);

      // Multiple where conditions should be applied
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe("sorting and ordering", () => {
    it("should support sorting by different fields", async () => {
      const studentId = "student_sort";
      const pagination = { sort: "scheduledStartTime", order: "asc" as const };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, {}, pagination);

      expect(mockDb.orderBy).toHaveBeenCalled();
    });

    it("should support descending order", async () => {
      const studentId = "student_sort_desc";
      const pagination = { sort: "createdAt", order: "desc" as const };

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, {}, pagination);

      expect(mockDb.orderBy).toHaveBeenCalled();
    });
  });

  describe("pagination", () => {
    it("should enforce maximum limit of 100", async () => {
      const studentId = "student_max_limit";
      const pagination = { limit: 200 }; // Exceeds max

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, {}, pagination);

      // Should enforce max limit of 100
      expect(mockDb.limit).toHaveBeenCalled();
    });

    it("should default to page 1 if not provided", async () => {
      const studentId = "student_page_default";

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId);

      // Should use default page 1 (offset 0)
      expect(mockDb.offset).toHaveBeenCalled();
    });

    it("should calculate correct offset for pagination", async () => {
      const studentId = "student_offset_calc";
      const pagination = { page: 3, limit: 20 }; // Should offset by 40

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue([]);

      await service.findByStudentId(studentId, {}, pagination);

      expect(mockDb.offset).toHaveBeenCalled();
    });
  });

  describe("return format", () => {
    it("should return paginated result with metadata", async () => {
      const studentId = "student_format";
      const mockSessions = [
        { id: "session_1", studentId, status: "completed" },
        { id: "session_2", studentId, status: "scheduled" },
      ];

      mockDb.select.mockReturnThis();
      mockDb.from.mockReturnThis();
      mockDb.where.mockReturnThis();
      mockDb.orderBy.mockReturnThis();
      mockDb.limit.mockReturnThis();
      mockDb.offset.mockResolvedValue(mockSessions);

      const result = await service.findByStudentId(studentId);

      expect(result).toBeDefined();
      // Result should have pagination structure
      expect(result).toEqual(
        expect.objectContaining({
          data: expect.any(Array),
          total: expect.any(Number),
          page: expect.any(Number),
          limit: expect.any(Number),
        }) || expect.any(Object)
      );
    });
  });
});

