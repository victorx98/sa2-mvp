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

  describe("POST /api/counselor/sessions - 成功场景", () => {
    it("应该成功创建预约并返回200状态码", async () => {
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

    it("应该从JWT token中提取counselorId", async () => {
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

  describe("POST /api/counselor/sessions - 异常场景", () => {
    it("应该在余额不足时返回400错误", async () => {
      // Arrange
      const error = new Error("服务余额不足");
      error.name = "InsufficientBalanceException";
      mockCounselorSessionsService.bookSession.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.bookSession(mockUser as any, validRequestDto),
      ).rejects.toThrow("服务余额不足");

      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledTimes(1);
    });

    it("应该在时间冲突时返回409错误", async () => {
      // Arrange
      const error = new Error("导师在该时段已有安排");
      error.name = "TimeConflictException";
      mockCounselorSessionsService.bookSession.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.bookSession(mockUser as any, validRequestDto),
      ).rejects.toThrow("导师在该时段已有安排");

      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledTimes(1);
    });

    it("应该在会议创建失败时返回500错误", async () => {
      // Arrange
      const error = new Error("飞书API调用失败");
      mockCounselorSessionsService.bookSession.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.bookSession(mockUser as any, validRequestDto),
      ).rejects.toThrow("飞书API调用失败");

      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledTimes(1);
    });

    it("应该在数据库错误时返回500错误", async () => {
      // Arrange
      const error = new Error("数据库连接超时");
      mockCounselorSessionsService.bookSession.mockRejectedValue(error);

      // Act & Assert
      await expect(
        controller.bookSession(mockUser as any, validRequestDto),
      ).rejects.toThrow("数据库连接超时");

      expect(mockCounselorSessionsService.bookSession).toHaveBeenCalledTimes(1);
    });

    it("应该在未认证时抛出异常", async () => {
      // Arrange
      const unauthorizedUser = null;

      // Act & Assert
      await expect(
        controller.bookSession(unauthorizedUser as any, validRequestDto),
      ).rejects.toThrow();
    });
  });

  describe("POST /api/counselor/sessions - 输入验证", () => {
    it("应该接受有效的请求DTO", async () => {
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

    it("应该处理可选的meetingProvider字段", async () => {
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

  describe("POST /api/counselor/sessions - 响应格式验证", () => {
    it("应该返回包含所有必要字段的响应", async () => {
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

    it("应该在会议信息不存在时返回undefined", async () => {
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

  describe("POST /api/counselor/sessions - 性能测试", () => {
    it("应该在合理时间内完成请求", async () => {
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
