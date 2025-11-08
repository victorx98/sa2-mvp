import { Test, TestingModule } from "@nestjs/testing";
import { CounselorSessionsController } from "./counselor-sessions.controller";
import { CounselorSessionsService } from "@operations/counselor-portal/sessions/sessions.service";
import { BookSessionRequestDto } from "@operations/counselor-portal/sessions/dto/book-session-request.dto";
import { SessionDetailResponseDto } from "@operations/counselor-portal/sessions/dto/session-detail-response.dto";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";

describe("CounselorSessionsController (API Layer)", () => {
  let controller: CounselorSessionsController;
  let mockCounselorSessionsService: jest.Mocked<CounselorSessionsService>;

  // Mock user from JWT (matches User interface)
  const mockUser = {
    id: "counselor-123",
    email: "counselor@test.com",
    role: "counselor",
  };

  // 测试数据
  const validRequestDto: BookSessionRequestDto = {
    studentId: "student-456",
    mentorId: "mentor-789",
    contractId: "contract-001",
    serviceId: "service-001",
    scheduledStartTime: "2025-12-01T10:00:00Z",
    scheduledEndTime: "2025-12-01T11:00:00Z",
    duration: 60,
    topic: "Test Session",
    meetingProvider: "feishu",
  };

  beforeEach(async () => {
    // Mock CounselorSessionsService
    mockCounselorSessionsService = {
      bookSession: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CounselorSessionsController],
      providers: [
        {
          provide: CounselorSessionsService,
          useValue: mockCounselorSessionsService,
        },
      ],
    }).compile();

    controller = module.get<CounselorSessionsController>(
      CounselorSessionsController,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/counselor/sessions - success cases", () => {
    it("should create a booking and return the session detail", async () => {
      // Arrange
      const mockResponse: SessionDetailResponseDto = {
        bookingId: "session-123",
        status: "scheduled",
        meeting: {
          url: "https://feishu.cn/meeting/123",
          password: "pass123",
          provider: "feishu",
        },
      };

      mockCounselorSessionsService.bookSession.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.bookSession(
        mockUser as any,
        validRequestDto,
      );

      // Assert
      expect(result).toEqual(mockResponse);
      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledWith(
        mockUser.id,
        validRequestDto,
      );
      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledTimes(1);
    });

    it("should read counselorId from the JWT payload", async () => {
      // Arrange
      const differentUser = {
        id: "counselor-999",
        email: "another@test.com",
        role: "counselor",
      };

      const mockResponse: SessionDetailResponseDto = {
        bookingId: "session-123",
        status: "scheduled",
        meeting: {
          url: "https://feishu.cn/meeting/123",
          password: "pass123",
          provider: "feishu",
        },
      };

      mockCounselorSessionsService.bookSession.mockResolvedValue(mockResponse);

      // Act
      await controller.bookSession(differentUser as any, validRequestDto);

      // Assert
      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledWith(
        differentUser.id,
        validRequestDto,
      );
    });
  });

  describe("POST /api/counselor/sessions - error cases", () => {
    it("should surface insufficient balance errors", async () => {
      // Arrange
      const error = new Error("Insufficient service balance");
      error.name = "InsufficientBalanceException";
      mockCounselorSessionsService.bookSession.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.bookSession(mockUser as any, validRequestDto),
      ).rejects.toThrow("Insufficient service balance");

      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledTimes(1);
    });

    it("should surface mentor time conflicts", async () => {
      // Arrange
      const error = new Error("The mentor already has a conflict");
      error.name = "TimeConflictException";
      mockCounselorSessionsService.bookSession.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.bookSession(mockUser as any, validRequestDto),
      ).rejects.toThrow("The mentor already has a conflict");

      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledTimes(1);
    });

    it("should propagate meeting creation failures", async () => {
      // Arrange
      const error = new Error("Feishu API call failed");
      mockCounselorSessionsService.bookSession.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.bookSession(mockUser as any, validRequestDto),
      ).rejects.toThrow("Feishu API call failed");

      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledTimes(1);
    });

    it("should propagate database errors", async () => {
      // Arrange
      const error = new Error("Database connection timed out");
      mockCounselorSessionsService.bookSession.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.bookSession(mockUser as any, validRequestDto),
      ).rejects.toThrow("Database connection timed out");

      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledTimes(1);
    });

    it("should throw when the user is unauthenticated", async () => {
      // Arrange
      const unauthorizedUser = null;

      // Act & Assert
      await expect(
        controller.bookSession(unauthorizedUser as any, validRequestDto),
      ).rejects.toThrow();
    });
  });

  describe("POST /api/counselor/sessions - input validation", () => {
    it("should accept a valid request DTO", async () => {
      // Arrange
      const mockResponse: SessionDetailResponseDto = {
        bookingId: "session-123",
        status: "scheduled",
        meeting: undefined,
      };

      mockCounselorSessionsService.bookSession.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.bookSession(
        mockUser as any,
        validRequestDto,
      );

      // Assert
      expect(result).toBeDefined();
      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledWith(
        mockUser.id,
        validRequestDto,
      );
    });

    it("should handle the optional meetingProvider field", async () => {
      // Arrange
      const dtoWithoutProvider = { ...validRequestDto };
      delete (dtoWithoutProvider as any).meetingProvider;

      const mockResponse: SessionDetailResponseDto = {
        bookingId: "session-123",
        status: "scheduled",
        meeting: {
          url: "https://feishu.cn/meeting/123",
          password: "pass123",
          provider: "feishu",
        },
      };

      mockCounselorSessionsService.bookSession.mockResolvedValue(mockResponse);

      // Act
      await controller.bookSession(mockUser as any, dtoWithoutProvider);

      // Assert
      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledWith(
        mockUser.id,
        dtoWithoutProvider,
      );
    });
  });

  describe("POST /api/counselor/sessions - response validation", () => {
    it("should return a response with all required fields", async () => {
      // Arrange
      const mockResponse: SessionDetailResponseDto = {
        bookingId: "session-123",
        status: "scheduled",
        meeting: {
          url: "https://feishu.cn/meeting/123",
          password: "pass123",
          provider: "feishu",
        },
      };

      mockCounselorSessionsService.bookSession.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.bookSession(
        mockUser as any,
        validRequestDto,
      );

      // Assert
      expect(result).toHaveProperty("bookingId");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("meeting");
    });

    it("should return undefined meeting when details are absent", async () => {
      // Arrange
      const mockResponse: SessionDetailResponseDto = {
        bookingId: "session-123",
        status: "scheduled",
        meeting: undefined,
      };

      mockCounselorSessionsService.bookSession.mockResolvedValue(mockResponse);

      // Act
      const result = await controller.bookSession(
        mockUser as any,
        validRequestDto,
      );

      // Assert
      expect(result.meeting).toBeUndefined();
    });
  });

  describe("POST /api/counselor/sessions - performance", () => {
    it("should complete the request within an acceptable time", async () => {
      // Arrange
      const mockResponse: SessionDetailResponseDto = {
        bookingId: "session-123",
        status: "scheduled",
        meeting: {
          url: "https://feishu.cn/meeting/123",
          password: "pass123",
          provider: "feishu",
        },
      };

      mockCounselorSessionsService.bookSession.mockResolvedValue(mockResponse);

      // Act
      const startTime = Date.now();
      await controller.bookSession(mockUser as any, validRequestDto);
      const endTime = Date.now();

      // Assert
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100); // Should complete in less than 100ms for mocked service
    });
  });
});
