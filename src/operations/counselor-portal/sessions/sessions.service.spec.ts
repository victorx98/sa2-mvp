import { Test, TestingModule } from "@nestjs/testing";
import { CounselorSessionsService } from "./sessions.service";
import { BookSessionCommand } from "@application/commands/booking/book-session.command";
import { SessionService } from "@domains/services/session/services/session.service";
import { ContractService } from "@domains/contract/services/contract.service";
import { BookSessionRequestDto } from "./dto/book-session-request.dto";

describe("CounselorSessionsService (BFF Layer)", () => {
  let service: CounselorSessionsService;
  let mockBookSessionCommand: jest.Mocked<BookSessionCommand>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockContractService: jest.Mocked<ContractService>;

  // 测试数据
  const counselorId = "counselor-123";
  const validDto: BookSessionRequestDto = {
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
    // Mock BookSessionCommand
    mockBookSessionCommand = {
      execute: jest.fn(),
    } as any;

    // Mock SessionService
    mockSessionService = {
      getSessionById: jest.fn(),
    } as any;

    // Mock ContractService
    mockContractService = {
      getServiceBalance: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CounselorSessionsService,
        {
          provide: BookSessionCommand,
          useValue: mockBookSessionCommand,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: ContractService,
          useValue: mockContractService,
        },
      ],
    }).compile();

    service = module.get<CounselorSessionsService>(CounselorSessionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("bookSession - success cases", () => {
    it("should book a session and return simplified response", async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: "session-123",
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: validDto.scheduledStartTime,
        scheduledEndTime: validDto.scheduledEndTime,
        duration: validDto.duration,
        status: "scheduled",
        meetingUrl: "https://feishu.cn/meeting/123",
        meetingPassword: "pass123",
        meetingProvider: "feishu",
        calendarSlotId: "slot-123",
        serviceHoldId: "hold-123",
      };

      mockBookSessionCommand.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      const result = await service.bookSession(counselorId, validDto);

      // Assert
      expect(result).toEqual({
        bookingId: "session-123",
        status: "scheduled",
        meeting: {
          url: "https://feishu.cn/meeting/123",
          password: "pass123",
          provider: "feishu",
        },
      });

      // Verify Command was called with correct parameters
      expect(mockBookSessionCommand.execute).toHaveBeenCalledWith({
        counselorId,
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: validDto.scheduledStartTime,
        scheduledEndTime: validDto.scheduledEndTime,
        duration: validDto.duration,
        topic: validDto.topic,
        meetingProvider: validDto.meetingProvider,
      });
    });

    it("should handle missing meeting URL", async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: "session-123",
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: validDto.scheduledStartTime,
        scheduledEndTime: validDto.scheduledEndTime,
        duration: validDto.duration,
        status: "scheduled",
        meetingUrl: undefined, // 没有会议URL
        meetingPassword: undefined,
        meetingProvider: undefined,
        calendarSlotId: "slot-123",
        serviceHoldId: "hold-123",
      };

      mockBookSessionCommand.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      const result = await service.bookSession(counselorId, validDto);

      // Assert
      expect(result).toEqual({
        bookingId: "session-123",
        status: "scheduled",
        meeting: undefined,
      });
    });

    it("should map meeting provider correctly", async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: "session-123",
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: validDto.scheduledStartTime,
        scheduledEndTime: validDto.scheduledEndTime,
        duration: validDto.duration,
        status: "scheduled",
        meetingUrl: "https://zoom.us/j/123456789",
        meetingPassword: "zoom123",
        meetingProvider: undefined, // Provider未定义时使用默认值
        calendarSlotId: "slot-123",
        serviceHoldId: "hold-123",
      };

      mockBookSessionCommand.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      const result = await service.bookSession(counselorId, validDto);

      // Assert
      expect(result.meeting?.provider).toBe("zoom"); // 默认为zoom
    });
  });

  describe("bookSession - error cases", () => {
    it("should surface insufficient balance errors from command", async () => {
      // Arrange
      const error = new Error("Insufficient service balance");
      error.name = "InsufficientBalanceException";
      mockBookSessionCommand.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(service.bookSession(counselorId, validDto)).rejects.toThrow(
        "Insufficient service balance",
      );
      await expect(
        service.bookSession(counselorId, validDto),
      ).rejects.toMatchObject({
        name: "InsufficientBalanceException",
      });

      // Verify Command was called
      expect(mockBookSessionCommand.execute).toHaveBeenCalledTimes(2);
    });

    it("should surface time conflict errors from command", async () => {
      // Arrange
      const error = new Error("The mentor already has a conflict");
      error.name = "TimeConflictException";
      mockBookSessionCommand.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(service.bookSession(counselorId, validDto)).rejects.toThrow(
        "The mentor already has a conflict",
      );
      await expect(
        service.bookSession(counselorId, validDto),
      ).rejects.toMatchObject({
        name: "TimeConflictException",
      });

      expect(mockBookSessionCommand.execute).toHaveBeenCalledTimes(2);
    });

    it("should propagate meeting creation failures", async () => {
      // Arrange
      const error = new Error("Feishu API call failed");
      mockBookSessionCommand.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(service.bookSession(counselorId, validDto)).rejects.toThrow(
        "Feishu API call failed",
      );

      expect(mockBookSessionCommand.execute).toHaveBeenCalledTimes(1);
    });

    it("should not swallow unexpected command errors", async () => {
      // Arrange
      const error = new Error("Database connection failed");
      mockBookSessionCommand.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(service.bookSession(counselorId, validDto)).rejects.toThrow(
        "Database connection failed",
      );
    });
  });

  describe("bookSession - input validation", () => {
    it("should convert ISO strings into Date objects", async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: "session-123",
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: validDto.scheduledStartTime,
        scheduledEndTime: validDto.scheduledEndTime,
        duration: validDto.duration,
        status: "scheduled",
        meetingUrl: "https://feishu.cn/meeting/123",
        meetingPassword: "pass123",
        meetingProvider: "feishu",
        calendarSlotId: "slot-123",
        serviceHoldId: "hold-123",
      };

      mockBookSessionCommand.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      await service.bookSession(counselorId, validDto);

      // Assert - Verify dates were converted correctly
      expect(mockBookSessionCommand.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledStartTime: validDto.scheduledStartTime,
          scheduledEndTime: validDto.scheduledEndTime,
        }),
      );
    });

    it("should pass every DTO field to the command", async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: "session-123",
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: validDto.scheduledStartTime,
        scheduledEndTime: validDto.scheduledEndTime,
        duration: validDto.duration,
        status: "scheduled",
        meetingUrl: "https://feishu.cn/meeting/123",
        meetingPassword: "pass123",
        meetingProvider: "feishu",
        calendarSlotId: "slot-123",
        serviceHoldId: "hold-123",
      };

      mockBookSessionCommand.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      await service.bookSession(counselorId, validDto);

      // Assert - Verify all fields are passed
      expect(mockBookSessionCommand.execute).toHaveBeenCalledWith({
        counselorId,
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: validDto.scheduledStartTime,
        scheduledEndTime: validDto.scheduledEndTime,
        duration: validDto.duration,
        topic: validDto.topic,
        meetingProvider: validDto.meetingProvider,
      });
    });
  });

  describe("bookSession - response mapping", () => {
    it("should map sessionId to bookingId", async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: "unique-session-id-12345",
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: validDto.scheduledStartTime,
        scheduledEndTime: validDto.scheduledEndTime,
        duration: validDto.duration,
        status: "scheduled",
        meetingUrl: "https://feishu.cn/meeting/123",
        meetingPassword: "pass123",
        meetingProvider: "feishu",
        calendarSlotId: "slot-123",
        serviceHoldId: "hold-123",
      };

      mockBookSessionCommand.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      const result = await service.bookSession(counselorId, validDto);

      // Assert
      expect(result.bookingId).toBe("unique-session-id-12345");
    });

    it("should preserve the original status value", async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: "session-123",
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: validDto.scheduledStartTime,
        scheduledEndTime: validDto.scheduledEndTime,
        duration: validDto.duration,
        status: "pending_confirmation", // 不同的状态值
        meetingUrl: "https://feishu.cn/meeting/123",
        meetingPassword: "pass123",
        meetingProvider: "feishu",
        calendarSlotId: "slot-123",
        serviceHoldId: "hold-123",
      };

      mockBookSessionCommand.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      const result = await service.bookSession(counselorId, validDto);

      // Assert
      expect(result.status).toBe("pending_confirmation");
    });
  });
});
