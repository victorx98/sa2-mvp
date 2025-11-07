import { Test, TestingModule } from "@nestjs/testing";
import { BookSessionCommand } from "./book-session.command";
import { CalendarService } from "@core/calendar";
import {
  ResourceType,
  SlotType,
} from "@core/calendar/interfaces/calendar-slot.interface";
import {
  MeetingProviderFactory,
  MeetingProviderType,
} from "@core/meeting-providers";
import { SessionService } from "@domains/services/session/services/session.service";
import { ContractService } from "@domains/contract/contract.service";
import { BookSessionInput } from "./dto/book-session-input.dto";
import {
  InsufficientBalanceException,
  TimeConflictException,
} from "@shared/exceptions";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";

describe("BookSessionCommand", () => {
  let command: BookSessionCommand;
  let mockDb: any;
  let mockContractService: jest.Mocked<ContractService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockCalendarService: jest.Mocked<CalendarService>;
  let mockMeetingProviderFactory: jest.Mocked<MeetingProviderFactory>;
  let mockMeetingProvider: any;

  // 测试数据
  const validInput: BookSessionInput = {
    counselorId: "counselor-123",
    studentId: "student-456",
    mentorId: "mentor-789",
    contractId: "contract-001",
    serviceId: "service-001",
    scheduledStartTime: new Date("2025-12-01T10:00:00Z"),
    scheduledEndTime: new Date("2025-12-01T11:00:00Z"),
    duration: 60,
    topic: "Test Session",
    meetingProvider: "feishu",
  };

  beforeEach(async () => {
    // Mock database with transaction support
    const mockTransaction = jest.fn();
    mockDb = {
      transaction: jest.fn((callback) => {
        // Execute callback with mock transaction context
        return callback(mockDb);
      }),
    };

    // Mock ContractService
    mockContractService = {
      getServiceBalance: jest.fn(),
      createServiceHold: jest.fn(),
    } as any;

    // Mock SessionService
    mockSessionService = {
      createSession: jest.fn(),
      getSessionById: jest.fn(),
    } as any;

    // Mock CalendarService
    mockCalendarService = {
      isSlotAvailable: jest.fn(),
      createOccupiedSlot: jest.fn(),
    } as any;

    // Mock MeetingProvider
    mockMeetingProvider = {
      createMeeting: jest.fn(),
    };

    // Mock MeetingProviderFactory
    mockMeetingProviderFactory = {
      getProvider: jest.fn().mockReturnValue(mockMeetingProvider),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookSessionCommand,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
        {
          provide: ContractService,
          useValue: mockContractService,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
        {
          provide: CalendarService,
          useValue: mockCalendarService,
        },
        {
          provide: MeetingProviderFactory,
          useValue: mockMeetingProviderFactory,
        },
      ],
    }).compile();

    command = module.get<BookSessionCommand>(BookSessionCommand);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("execute - 成功场景", () => {
    it("应该成功预约会话并返回完整信息", async () => {
      // Arrange
      const mockBalance = { available: 10, used: 5, total: 15 };
      const mockHold = {
        id: "hold-123",
        contractId: validInput.contractId,
        serviceId: validInput.serviceId,
        sessionId: "temp_session_id",
        quantity: 1,
        createdAt: new Date(),
      };
      const mockMeeting = {
        provider: MeetingProviderType.FEISHU,
        meetingId: "meeting-123",
        meetingNo: "123456789",
        meetingUrl: "https://feishu.cn/meeting/123",
        meetingPassword: "pass123",
        hostJoinUrl: null,
        startTime: validInput.scheduledStartTime,
        duration: validInput.duration,
      };
      const mockSession = {
        id: "session-123",
        studentId: validInput.studentId,
        mentorId: validInput.mentorId,
        contractId: validInput.contractId,
        status: "scheduled",
        scheduledStartTime: validInput.scheduledStartTime,
        scheduledDuration: validInput.duration,
      };
      const mockCalendarSlot = {
        id: "slot-123",
        resourceType: ResourceType.MENTOR,
        resourceId: validInput.mentorId,
        sessionId: mockSession.id,
        status: "occupied",
      };

      mockContractService.getServiceBalance.mockResolvedValue(mockBalance);
      mockCalendarService.isSlotAvailable.mockResolvedValue(true);
      mockContractService.createServiceHold.mockResolvedValue(mockHold);
      mockMeetingProvider.createMeeting.mockResolvedValue(mockMeeting);
      mockSessionService.createSession.mockResolvedValue(mockSession as any);
      mockCalendarService.createOccupiedSlot.mockResolvedValue(
        mockCalendarSlot as any,
      );

      // Act
      const result = await command.execute(validInput);

      // Assert
      expect(result).toEqual({
        sessionId: mockSession.id,
        studentId: validInput.studentId,
        mentorId: validInput.mentorId,
        contractId: validInput.contractId,
        serviceId: validInput.serviceId,
        scheduledStartTime: validInput.scheduledStartTime,
        scheduledEndTime: validInput.scheduledEndTime,
        duration: validInput.duration,
        status: mockSession.status,
        meetingUrl: mockMeeting.meetingUrl,
        meetingPassword: mockMeeting.meetingPassword,
        meetingProvider: mockMeeting.provider,
        calendarSlotId: mockCalendarSlot.id,
        serviceHoldId: mockHold.id,
      });

      // Verify transaction was used
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Verify all steps were called in correct order
      expect(mockContractService.getServiceBalance).toHaveBeenCalledWith(
        validInput.contractId,
        validInput.serviceId,
      );
      expect(mockCalendarService.isSlotAvailable).toHaveBeenCalledWith(
        ResourceType.MENTOR,
        validInput.mentorId,
        validInput.scheduledStartTime,
        validInput.duration,
      );
      expect(mockContractService.createServiceHold).toHaveBeenCalledWith({
        contractId: validInput.contractId,
        serviceId: validInput.serviceId,
        sessionId: "temp_session_id",
        quantity: 1,
      });
      expect(mockMeetingProviderFactory.getProvider).toHaveBeenCalledWith(
        MeetingProviderType.FEISHU,
      );
      expect(mockMeetingProvider.createMeeting).toHaveBeenCalledWith({
        topic: validInput.topic,
        startTime: validInput.scheduledStartTime,
        duration: validInput.duration,
        hostUserId: validInput.mentorId,
      });
      expect(mockSessionService.createSession).toHaveBeenCalledWith({
        studentId: validInput.studentId,
        mentorId: validInput.mentorId,
        contractId: validInput.contractId,
        scheduledStartTime: validInput.scheduledStartTime.toISOString(),
        scheduledDuration: validInput.duration,
        sessionName: validInput.topic,
        meetingProvider: validInput.meetingProvider,
      });
      expect(mockCalendarService.createOccupiedSlot).toHaveBeenCalledWith({
        resourceType: ResourceType.MENTOR,
        resourceId: validInput.mentorId,
        startTime: validInput.scheduledStartTime.toISOString(),
        durationMinutes: validInput.duration,
        sessionId: mockSession.id,
        slotType: SlotType.SESSION,
      });
    });
  });

  describe("execute - 余额不足场景", () => {
    it("应该在余额不足时抛出 InsufficientBalanceException", async () => {
      // Arrange
      const mockBalance = { available: 0, used: 15, total: 15 };
      mockContractService.getServiceBalance.mockResolvedValue(mockBalance);

      // Act & Assert
      await expect(command.execute(validInput)).rejects.toThrow(
        InsufficientBalanceException,
      );
      await expect(command.execute(validInput)).rejects.toThrow("服务余额不足");

      // Verify transaction was attempted
      expect(mockDb.transaction).toHaveBeenCalledTimes(2);

      // Verify balance check was called
      expect(mockContractService.getServiceBalance).toHaveBeenCalledTimes(2);

      // Verify subsequent steps were NOT called
      expect(mockCalendarService.isSlotAvailable).not.toHaveBeenCalled();
      expect(mockContractService.createServiceHold).not.toHaveBeenCalled();
      expect(mockMeetingProvider.createMeeting).not.toHaveBeenCalled();
      expect(mockSessionService.createSession).not.toHaveBeenCalled();
      expect(mockCalendarService.createOccupiedSlot).not.toHaveBeenCalled();
    });

    it("应该在余额刚好为0时抛出异常", async () => {
      // Arrange
      const mockBalance = { available: 0, used: 10, total: 10 };
      mockContractService.getServiceBalance.mockResolvedValue(mockBalance);

      // Act & Assert
      await expect(command.execute(validInput)).rejects.toThrow(
        new InsufficientBalanceException("服务余额不足"),
      );
    });
  });

  describe("execute - 时间冲突场景", () => {
    it("应该在时间冲突时抛出 TimeConflictException", async () => {
      // Arrange
      const mockBalance = { available: 10, used: 5, total: 15 };
      mockContractService.getServiceBalance.mockResolvedValue(mockBalance);
      mockCalendarService.isSlotAvailable.mockResolvedValue(false);

      // Act & Assert
      await expect(command.execute(validInput)).rejects.toThrow(
        TimeConflictException,
      );
      await expect(command.execute(validInput)).rejects.toThrow(
        "导师在该时段已有安排",
      );

      // Verify balance check was called
      expect(mockContractService.getServiceBalance).toHaveBeenCalledTimes(2);

      // Verify availability check was called
      expect(mockCalendarService.isSlotAvailable).toHaveBeenCalledTimes(2);

      // Verify subsequent steps were NOT called
      expect(mockContractService.createServiceHold).not.toHaveBeenCalled();
      expect(mockMeetingProvider.createMeeting).not.toHaveBeenCalled();
      expect(mockSessionService.createSession).not.toHaveBeenCalled();
      expect(mockCalendarService.createOccupiedSlot).not.toHaveBeenCalled();
    });
  });

  describe("execute - 会议创建失败场景 (事务回滚验证)", () => {
    it("应该在会议创建失败时回滚整个事务", async () => {
      // Arrange
      const mockBalance = { available: 10, used: 5, total: 15 };
      const mockHold = {
        id: "hold-123",
        contractId: validInput.contractId,
        serviceId: validInput.serviceId,
        sessionId: "temp_session_id",
        quantity: 1,
        createdAt: new Date(),
      };
      const meetingError = new Error("飞书API调用失败");

      mockContractService.getServiceBalance.mockResolvedValue(mockBalance);
      mockCalendarService.isSlotAvailable.mockResolvedValue(true);
      mockContractService.createServiceHold.mockResolvedValue(mockHold);
      mockMeetingProvider.createMeeting.mockRejectedValue(meetingError);

      // Act & Assert
      await expect(command.execute(validInput)).rejects.toThrow(
        "飞书API调用失败",
      );

      // Verify transaction was attempted
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);

      // Verify steps before meeting creation were called
      expect(mockContractService.getServiceBalance).toHaveBeenCalledTimes(1);
      expect(mockCalendarService.isSlotAvailable).toHaveBeenCalledTimes(1);
      expect(mockContractService.createServiceHold).toHaveBeenCalledTimes(1);
      expect(mockMeetingProvider.createMeeting).toHaveBeenCalledTimes(1);

      // Verify steps after meeting creation were NOT called
      expect(mockSessionService.createSession).not.toHaveBeenCalled();
      expect(mockCalendarService.createOccupiedSlot).not.toHaveBeenCalled();
    });

    it("应该在Zoom会议创建失败时回滚事务", async () => {
      // Arrange
      const zoomInput = { ...validInput, meetingProvider: "zoom" };
      const mockBalance = { available: 10, used: 5, total: 15 };
      const meetingError = new Error("Zoom token expired");

      mockContractService.getServiceBalance.mockResolvedValue(mockBalance);
      mockCalendarService.isSlotAvailable.mockResolvedValue(true);
      mockContractService.createServiceHold.mockResolvedValue({
        id: "hold-123",
        contractId: zoomInput.contractId,
        serviceId: zoomInput.serviceId,
        sessionId: "temp_session_id",
        quantity: 1,
        createdAt: new Date(),
      });
      mockMeetingProvider.createMeeting.mockRejectedValue(meetingError);

      // Act & Assert
      await expect(command.execute(zoomInput as any)).rejects.toThrow(
        "Zoom token expired",
      );

      expect(mockMeetingProviderFactory.getProvider).toHaveBeenCalledWith(
        MeetingProviderType.ZOOM,
      );
      expect(mockSessionService.createSession).not.toHaveBeenCalled();
    });
  });

  describe("execute - Session创建失败场景", () => {
    it("应该在Session创建失败时抛出错误并回滚", async () => {
      // Arrange
      const mockBalance = { available: 10, used: 5, total: 15 };
      const mockHold = {
        id: "hold-123",
        contractId: validInput.contractId,
        serviceId: validInput.serviceId,
        sessionId: "temp_session_id",
        quantity: 1,
        createdAt: new Date(),
      };
      const mockMeeting = {
        provider: MeetingProviderType.FEISHU,
        meetingId: "meeting-123",
        meetingNo: "123456789",
        meetingUrl: "https://feishu.cn/meeting/123",
        meetingPassword: "pass123",
        hostJoinUrl: null,
        startTime: validInput.scheduledStartTime,
        duration: validInput.duration,
      };
      const sessionError = new Error("数据库约束违反");

      mockContractService.getServiceBalance.mockResolvedValue(mockBalance);
      mockCalendarService.isSlotAvailable.mockResolvedValue(true);
      mockContractService.createServiceHold.mockResolvedValue(mockHold);
      mockMeetingProvider.createMeeting.mockResolvedValue(mockMeeting);
      mockSessionService.createSession.mockRejectedValue(sessionError);

      // Act & Assert
      await expect(command.execute(validInput)).rejects.toThrow(
        "数据库约束违反",
      );

      // Verify all steps up to session creation were called
      expect(mockContractService.getServiceBalance).toHaveBeenCalledTimes(1);
      expect(mockCalendarService.isSlotAvailable).toHaveBeenCalledTimes(1);
      expect(mockContractService.createServiceHold).toHaveBeenCalledTimes(1);
      expect(mockMeetingProvider.createMeeting).toHaveBeenCalledTimes(1);
      expect(mockSessionService.createSession).toHaveBeenCalledTimes(1);

      // Verify calendar slot creation was NOT called
      expect(mockCalendarService.createOccupiedSlot).not.toHaveBeenCalled();
    });
  });

  describe("execute - 日历时段占用失败场景", () => {
    it("应该在日历占用失败时抛出错误", async () => {
      // Arrange
      const mockBalance = { available: 10, used: 5, total: 15 };
      const mockHold = {
        id: "hold-123",
        contractId: validInput.contractId,
        serviceId: validInput.serviceId,
        sessionId: "temp_session_id",
        quantity: 1,
        createdAt: new Date(),
      };
      const mockMeeting = {
        provider: MeetingProviderType.FEISHU,
        meetingId: "meeting-123",
        meetingNo: "123456789",
        meetingUrl: "https://feishu.cn/meeting/123",
        meetingPassword: "pass123",
        hostJoinUrl: null,
        startTime: validInput.scheduledStartTime,
        duration: validInput.duration,
      };
      const mockSession = {
        id: "session-123",
        studentId: validInput.studentId,
        mentorId: validInput.mentorId,
        contractId: validInput.contractId,
        status: "scheduled",
        scheduledStartTime: validInput.scheduledStartTime,
        scheduledDuration: validInput.duration,
      };
      const calendarError = new Error("日历服务不可用");

      mockContractService.getServiceBalance.mockResolvedValue(mockBalance);
      mockCalendarService.isSlotAvailable.mockResolvedValue(true);
      mockContractService.createServiceHold.mockResolvedValue(mockHold);
      mockMeetingProvider.createMeeting.mockResolvedValue(mockMeeting);
      mockSessionService.createSession.mockResolvedValue(mockSession as any);
      mockCalendarService.createOccupiedSlot.mockRejectedValue(calendarError);

      // Act & Assert
      await expect(command.execute(validInput)).rejects.toThrow(
        "日历服务不可用",
      );

      // Verify all steps were called
      expect(mockContractService.getServiceBalance).toHaveBeenCalledTimes(1);
      expect(mockCalendarService.isSlotAvailable).toHaveBeenCalledTimes(1);
      expect(mockContractService.createServiceHold).toHaveBeenCalledTimes(1);
      expect(mockMeetingProvider.createMeeting).toHaveBeenCalledTimes(1);
      expect(mockSessionService.createSession).toHaveBeenCalledTimes(1);
      expect(mockCalendarService.createOccupiedSlot).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute - 边界值测试", () => {
    it("应该处理余额刚好为1的情况", async () => {
      // Arrange
      const mockBalance = { available: 1, used: 14, total: 15 };
      const mockHold = {
        id: "hold-123",
        contractId: validInput.contractId,
        serviceId: validInput.serviceId,
        sessionId: "temp_session_id",
        quantity: 1,
        createdAt: new Date(),
      };
      const mockMeeting = {
        provider: MeetingProviderType.FEISHU,
        meetingId: "meeting-123",
        meetingNo: "123456789",
        meetingUrl: "https://feishu.cn/meeting/123",
        meetingPassword: "pass123",
        hostJoinUrl: null,
        startTime: validInput.scheduledStartTime,
        duration: validInput.duration,
      };
      const mockSession = {
        id: "session-123",
        studentId: validInput.studentId,
        mentorId: validInput.mentorId,
        contractId: validInput.contractId,
        status: "scheduled",
        scheduledStartTime: validInput.scheduledStartTime,
        scheduledDuration: validInput.duration,
      };
      const mockCalendarSlot = {
        id: "slot-123",
        resourceType: ResourceType.MENTOR,
        resourceId: validInput.mentorId,
        sessionId: mockSession.id,
        status: "occupied",
      };

      mockContractService.getServiceBalance.mockResolvedValue(mockBalance);
      mockCalendarService.isSlotAvailable.mockResolvedValue(true);
      mockContractService.createServiceHold.mockResolvedValue(mockHold);
      mockMeetingProvider.createMeeting.mockResolvedValue(mockMeeting);
      mockSessionService.createSession.mockResolvedValue(mockSession as any);
      mockCalendarService.createOccupiedSlot.mockResolvedValue(
        mockCalendarSlot as any,
      );

      // Act
      const result = await command.execute(validInput);

      // Assert
      expect(result.sessionId).toBe(mockSession.id);
      expect(mockContractService.getServiceBalance).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute - 默认会议提供商测试", () => {
    it("应该在未指定provider时使用默认的FEISHU", async () => {
      // Arrange
      const inputWithoutProvider = {
        ...validInput,
        meetingProvider: undefined,
      };
      const mockBalance = { available: 10, used: 5, total: 15 };
      const mockHold = {
        id: "hold-123",
        contractId: validInput.contractId,
        serviceId: validInput.serviceId,
        sessionId: "temp_session_id",
        quantity: 1,
        createdAt: new Date(),
      };
      const mockMeeting = {
        provider: MeetingProviderType.FEISHU,
        meetingId: "meeting-123",
        meetingNo: "123456789",
        meetingUrl: "https://feishu.cn/meeting/123",
        meetingPassword: "pass123",
        hostJoinUrl: null,
        startTime: validInput.scheduledStartTime,
        duration: validInput.duration,
      };
      const mockSession = {
        id: "session-123",
        studentId: validInput.studentId,
        mentorId: validInput.mentorId,
        contractId: validInput.contractId,
        status: "scheduled",
        scheduledStartTime: validInput.scheduledStartTime,
        scheduledDuration: validInput.duration,
      };
      const mockCalendarSlot = {
        id: "slot-123",
        resourceType: ResourceType.MENTOR,
        resourceId: validInput.mentorId,
        sessionId: mockSession.id,
        status: "occupied",
      };

      mockContractService.getServiceBalance.mockResolvedValue(mockBalance);
      mockCalendarService.isSlotAvailable.mockResolvedValue(true);
      mockContractService.createServiceHold.mockResolvedValue(mockHold);
      mockMeetingProvider.createMeeting.mockResolvedValue(mockMeeting);
      mockSessionService.createSession.mockResolvedValue(mockSession as any);
      mockCalendarService.createOccupiedSlot.mockResolvedValue(
        mockCalendarSlot as any,
      );

      // Act
      await command.execute(inputWithoutProvider as any);

      // Assert
      expect(mockMeetingProviderFactory.getProvider).toHaveBeenCalledWith(
        MeetingProviderType.FEISHU,
      );
    });
  });
});
