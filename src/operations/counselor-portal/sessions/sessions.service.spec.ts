import { Test, TestingModule } from '@nestjs/testing';
import { CounselorSessionsService } from './sessions.service';
import { BookSessionUseCase } from '@application/use-cases/booking/book-session.use-case';
import { SessionService } from '@domains/services/session/services/session.service';
import { ContractService } from '@domains/contract/contract.service';
import { BookSessionRequestDto } from './dto/book-session-request.dto';
import { SessionDetailResponseDto } from './dto/session-detail-response.dto';

describe('CounselorSessionsService (BFF Layer)', () => {
  let service: CounselorSessionsService;
  let mockBookSessionUseCase: jest.Mocked<BookSessionUseCase>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockContractService: jest.Mocked<ContractService>;

  // 测试数据
  const counselorId = 'counselor-123';
  const validDto: BookSessionRequestDto = {
    studentId: 'student-456',
    mentorId: 'mentor-789',
    contractId: 'contract-001',
    serviceId: 'service-001',
    scheduledStartTime: '2025-12-01T10:00:00Z',
    scheduledEndTime: '2025-12-01T11:00:00Z',
    duration: 60,
    topic: 'Test Session',
    meetingProvider: 'feishu',
  };

  beforeEach(async () => {
    // Mock BookSessionUseCase
    mockBookSessionUseCase = {
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
          provide: BookSessionUseCase,
          useValue: mockBookSessionUseCase,
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

  describe('bookSession - 成功场景', () => {
    it('应该成功预约并返回简化的响应数据', async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: 'session-123',
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: new Date(validDto.scheduledStartTime),
        scheduledEndTime: new Date(validDto.scheduledEndTime),
        duration: validDto.duration,
        status: 'scheduled',
        meetingUrl: 'https://feishu.cn/meeting/123',
        meetingPassword: 'pass123',
        meetingProvider: 'feishu',
        calendarSlotId: 'slot-123',
        serviceHoldId: 'hold-123',
      };

      mockBookSessionUseCase.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      const result = await service.bookSession(counselorId, validDto);

      // Assert
      expect(result).toEqual({
        bookingId: 'session-123',
        status: 'scheduled',
        meeting: {
          url: 'https://feishu.cn/meeting/123',
          password: 'pass123',
          provider: 'feishu',
        },
      });

      // Verify UseCase was called with correct parameters
      expect(mockBookSessionUseCase.execute).toHaveBeenCalledWith({
        counselorId,
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: new Date(validDto.scheduledStartTime),
        scheduledEndTime: new Date(validDto.scheduledEndTime),
        duration: validDto.duration,
        topic: validDto.topic,
        meetingProvider: validDto.meetingProvider,
      });
    });

    it('应该处理没有会议URL的情况', async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: 'session-123',
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: new Date(validDto.scheduledStartTime),
        scheduledEndTime: new Date(validDto.scheduledEndTime),
        duration: validDto.duration,
        status: 'scheduled',
        meetingUrl: undefined, // 没有会议URL
        meetingPassword: undefined,
        meetingProvider: undefined,
        calendarSlotId: 'slot-123',
        serviceHoldId: 'hold-123',
      };

      mockBookSessionUseCase.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      const result = await service.bookSession(counselorId, validDto);

      // Assert
      expect(result).toEqual({
        bookingId: 'session-123',
        status: 'scheduled',
        meeting: undefined,
      });
    });

    it('应该正确映射会议provider', async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: 'session-123',
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: new Date(validDto.scheduledStartTime),
        scheduledEndTime: new Date(validDto.scheduledEndTime),
        duration: validDto.duration,
        status: 'scheduled',
        meetingUrl: 'https://zoom.us/j/123456789',
        meetingPassword: 'zoom123',
        meetingProvider: undefined, // Provider未定义时使用默认值
        calendarSlotId: 'slot-123',
        serviceHoldId: 'hold-123',
      };

      mockBookSessionUseCase.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      const result = await service.bookSession(counselorId, validDto);

      // Assert
      expect(result.meeting?.provider).toBe('zoom'); // 默认为zoom
    });
  });

  describe('bookSession - 异常场景', () => {
    it('应该在UseCase抛出余额不足异常时传递错误', async () => {
      // Arrange
      const error = new Error('服务余额不足');
      error.name = 'InsufficientBalanceException';
      mockBookSessionUseCase.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(service.bookSession(counselorId, validDto)).rejects.toThrow(
        '服务余额不足',
      );
      await expect(service.bookSession(counselorId, validDto)).rejects.toMatchObject({
        name: 'InsufficientBalanceException',
      });

      // Verify UseCase was called
      expect(mockBookSessionUseCase.execute).toHaveBeenCalledTimes(2);
    });

    it('应该在UseCase抛出时间冲突异常时传递错误', async () => {
      // Arrange
      const error = new Error('导师在该时段已有安排');
      error.name = 'TimeConflictException';
      mockBookSessionUseCase.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(service.bookSession(counselorId, validDto)).rejects.toThrow(
        '导师在该时段已有安排',
      );
      await expect(service.bookSession(counselorId, validDto)).rejects.toMatchObject({
        name: 'TimeConflictException',
      });

      expect(mockBookSessionUseCase.execute).toHaveBeenCalledTimes(2);
    });

    it('应该在会议创建失败时传递错误', async () => {
      // Arrange
      const error = new Error('飞书API调用失败');
      mockBookSessionUseCase.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(service.bookSession(counselorId, validDto)).rejects.toThrow(
        '飞书API调用失败',
      );

      expect(mockBookSessionUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('应该在UseCase抛出任何异常时都不吞掉错误', async () => {
      // Arrange
      const error = new Error('数据库连接失败');
      mockBookSessionUseCase.execute.mockRejectedValue(error);

      // Act & Assert
      await expect(service.bookSession(counselorId, validDto)).rejects.toThrow(
        '数据库连接失败',
      );
    });
  });

  describe('bookSession - 输入验证', () => {
    it('应该正确转换日期字符串为Date对象', async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: 'session-123',
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: new Date(validDto.scheduledStartTime),
        scheduledEndTime: new Date(validDto.scheduledEndTime),
        duration: validDto.duration,
        status: 'scheduled',
        meetingUrl: 'https://feishu.cn/meeting/123',
        meetingPassword: 'pass123',
        meetingProvider: 'feishu',
        calendarSlotId: 'slot-123',
        serviceHoldId: 'hold-123',
      };

      mockBookSessionUseCase.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      await service.bookSession(counselorId, validDto);

      // Assert - Verify dates were converted correctly
      expect(mockBookSessionUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          scheduledStartTime: new Date(validDto.scheduledStartTime),
          scheduledEndTime: new Date(validDto.scheduledEndTime),
        }),
      );
    });

    it('应该将所有DTO字段传递给UseCase', async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: 'session-123',
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: new Date(validDto.scheduledStartTime),
        scheduledEndTime: new Date(validDto.scheduledEndTime),
        duration: validDto.duration,
        status: 'scheduled',
        meetingUrl: 'https://feishu.cn/meeting/123',
        meetingPassword: 'pass123',
        meetingProvider: 'feishu',
        calendarSlotId: 'slot-123',
        serviceHoldId: 'hold-123',
      };

      mockBookSessionUseCase.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      await service.bookSession(counselorId, validDto);

      // Assert - Verify all fields are passed
      expect(mockBookSessionUseCase.execute).toHaveBeenCalledWith({
        counselorId,
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: new Date(validDto.scheduledStartTime),
        scheduledEndTime: new Date(validDto.scheduledEndTime),
        duration: validDto.duration,
        topic: validDto.topic,
        meetingProvider: validDto.meetingProvider,
      });
    });
  });

  describe('bookSession - 响应转换', () => {
    it('应该将sessionId映射为bookingId', async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: 'unique-session-id-12345',
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: new Date(validDto.scheduledStartTime),
        scheduledEndTime: new Date(validDto.scheduledEndTime),
        duration: validDto.duration,
        status: 'scheduled',
        meetingUrl: 'https://feishu.cn/meeting/123',
        meetingPassword: 'pass123',
        meetingProvider: 'feishu',
        calendarSlotId: 'slot-123',
        serviceHoldId: 'hold-123',
      };

      mockBookSessionUseCase.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      const result = await service.bookSession(counselorId, validDto);

      // Assert
      expect(result.bookingId).toBe('unique-session-id-12345');
    });

    it('应该保留原始status值', async () => {
      // Arrange
      const mockUseCaseResult = {
        sessionId: 'session-123',
        studentId: validDto.studentId,
        mentorId: validDto.mentorId,
        contractId: validDto.contractId,
        serviceId: validDto.serviceId,
        scheduledStartTime: new Date(validDto.scheduledStartTime),
        scheduledEndTime: new Date(validDto.scheduledEndTime),
        duration: validDto.duration,
        status: 'pending_confirmation', // 不同的状态值
        meetingUrl: 'https://feishu.cn/meeting/123',
        meetingPassword: 'pass123',
        meetingProvider: 'feishu',
        calendarSlotId: 'slot-123',
        serviceHoldId: 'hold-123',
      };

      mockBookSessionUseCase.execute.mockResolvedValue(mockUseCaseResult);

      // Act
      const result = await service.bookSession(counselorId, validDto);

      // Assert
      expect(result.status).toBe('pending_confirmation');
    });
  });
});
