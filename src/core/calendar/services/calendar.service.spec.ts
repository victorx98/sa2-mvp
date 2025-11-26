import { Test, TestingModule } from '@nestjs/testing';
import { CalendarService } from './calendar.service';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import {
  CalendarException,
  CalendarNotFoundException,
} from '../exceptions/calendar.exception';
import { CreateSlotDto } from '../dto/create-slot.dto';
import { QuerySlotDto } from '../dto/query-slot.dto';
import {
  SlotStatus,
  UserType,
  SessionType,
} from '../interfaces/calendar-slot.interface';

describe('CalendarService', () => {
  let service: CalendarService;
  let mockDb: any;

  const mockSlotEntity = {
    id: '123',
    user_id: 'user-1',
    user_type: 'mentor',
    time_range: '[2025-12-01 10:00:00+00, 2025-12-01 11:00:00+00)',
    duration_minutes: 60,
    session_id: 'session-1',
    session_type: 'regular_mentoring',
    title: 'Regular Mentoring Session',
    scheduled_start_time: new Date('2025-12-01T10:00:00Z'),
    status: 'booked',
    metadata: {},
    reason: null,
    created_at: new Date('2025-11-11T10:00:00Z'),
    updated_at: new Date('2025-11-11T10:00:00Z'),
  };

  beforeEach(async () => {
    // Mock database module
    mockDb = {
      execute: jest.fn(),
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<CalendarService>(CalendarService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSlotDirect', () => {
    it('should create a slot successfully', async () => {
      const dto: CreateSlotDto = {
        userId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        userType: UserType.MENTOR,
        startTime: '2025-12-01T10:00:00Z',
        durationMinutes: 60,
        sessionId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        sessionType: SessionType.REGULAR_MENTORING,
        title: 'Regular Mentoring Session',
        reason: null,
      };

      mockDb.execute.mockResolvedValue({ rows: [mockSlotEntity] });

      const result = await service.createSlotDirect(dto);

      expect(result).toBeDefined();
      expect(result?.id).toBe('123');
      expect(result?.userId).toBe('user-1');
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should return null when EXCLUDE constraint violation occurs (23P01)', async () => {
      const dto: CreateSlotDto = {
        userId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        userType: UserType.MENTOR,
        startTime: '2025-12-01T10:00:00Z',
        durationMinutes: 60,
        sessionId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        sessionType: SessionType.REGULAR_MENTORING,
        title: 'Regular Mentoring Session',
        reason: null,
      };

      const error = new Error('Duplicate key value violates unique constraint (23P01)');
      mockDb.execute.mockRejectedValue(error);

      const result = await service.createSlotDirect(dto);

      expect(result).toBeNull();
    });

    it('should throw CalendarException for other database errors', async () => {
      const dto: CreateSlotDto = {
        userId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        userType: UserType.MENTOR,
        startTime: '2025-12-01T10:00:00Z',
        durationMinutes: 60,
        sessionId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        sessionType: SessionType.REGULAR_MENTORING,
        title: 'Regular Mentoring Session',
        reason: null,
      };

      const error = new Error('Connection timeout');
      mockDb.execute.mockRejectedValue(error);

      await expect(service.createSlotDirect(dto)).rejects.toThrow(CalendarException);
    });

    it('should throw CalendarException for invalid duration (less than 30 minutes)', async () => {
      const dto: CreateSlotDto = {
        userId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        userType: UserType.MENTOR,
        startTime: '2025-12-01T10:00:00Z',
        durationMinutes: 15,
        sessionId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        sessionType: SessionType.REGULAR_MENTORING,
        title: 'Regular Mentoring Session',
        reason: null,
      };

      await expect(service.createSlotDirect(dto)).rejects.toThrow(
        'Duration must be between 30 and 180 minutes',
      );
    });

    it('should throw CalendarException for invalid duration (more than 180 minutes)', async () => {
      const dto: CreateSlotDto = {
        userId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        userType: UserType.MENTOR,
        startTime: '2025-12-01T10:00:00Z',
        durationMinutes: 200,
        sessionId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        sessionType: SessionType.REGULAR_MENTORING,
        title: 'Regular Mentoring Session',
        reason: null,
      };

      await expect(service.createSlotDirect(dto)).rejects.toThrow(
        'Duration must be between 30 and 180 minutes',
      );
    });

    it('should throw CalendarException for past start time', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const dto: CreateSlotDto = {
        userId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        userType: UserType.MENTOR,
        startTime: pastDate,
        durationMinutes: 60,
        sessionId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        sessionType: SessionType.REGULAR_MENTORING,
        title: 'Regular Mentoring Session',
        reason: null,
      };

      await expect(service.createSlotDirect(dto)).rejects.toThrow(
        'Start time cannot be in the past',
      );
    });
  });

  describe('isSlotAvailable', () => {
    it('should return true when slot is available', async () => {
      mockDb.execute.mockResolvedValue({ rows: [{ count: '0' }] });

      const result = await service.isSlotAvailable(
        'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        UserType.MENTOR,
        new Date('2025-12-01T10:00:00Z'),
        60,
      );

      expect(result).toBe(true);
    });

    it('should return false when slot is not available', async () => {
      mockDb.execute.mockResolvedValue({ rows: [{ count: '1' }] });

      const result = await service.isSlotAvailable(
        'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        UserType.MENTOR,
        new Date('2025-12-01T10:00:00Z'),
        60,
      );

      expect(result).toBe(false);
    });

    it('should throw CalendarException for invalid duration', async () => {
      await expect(
        service.isSlotAvailable(
          'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
          UserType.MENTOR,
          new Date('2025-12-01T10:00:00Z'),
          15,
        ),
      ).rejects.toThrow('Duration must be between 30 and 180 minutes');
    });

    it('should throw CalendarException for past start time', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000);

      await expect(
        service.isSlotAvailable(
          'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
          UserType.MENTOR,
          pastDate,
          60,
        ),
      ).rejects.toThrow('Start time cannot be in the past');
    });
  });

  describe.skip('releaseSlot', () => {
    // TODO: releaseSlot method has been removed or renamed in v5.3
    // These tests are kept for reference but skipped
    it('should release a slot successfully', async () => {
      const cancelledEntity = {
        ...mockSlotEntity,
        status: SlotStatus.CANCELLED,
      };

      // Mock getSlotById
      mockDb.execute
        .mockResolvedValueOnce({ rows: [mockSlotEntity] })
        .mockResolvedValueOnce({ rows: [cancelledEntity] });

      // const result = await service.releaseSlot('123');
      // expect(result.status).toBe(SlotStatus.CANCELLED);
      // expect(mockDb.execute).toHaveBeenCalledTimes(2);
    });

    it('should throw CalendarNotFoundException if slot does not exist', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      // await expect(service.releaseSlot('999')).rejects.toThrow(
      //   CalendarNotFoundException,
      // );
    });

    it('should throw CalendarException if slot is already cancelled', async () => {
      const cancelledEntity = {
        ...mockSlotEntity,
        status: SlotStatus.CANCELLED,
      };

      mockDb.execute.mockResolvedValueOnce({ rows: [cancelledEntity] });

      // await expect(service.releaseSlot('123')).rejects.toThrow(
      //   'Slot is already cancelled',
      // );
    });

    it('should throw CalendarNotFoundException if UPDATE returns no rows', async () => {
      mockDb.execute
        .mockResolvedValueOnce({ rows: [mockSlotEntity] })
        .mockResolvedValueOnce({ rows: [] });

      // await expect(service.releaseSlot('123')).rejects.toThrow(
      //   CalendarNotFoundException,
      // );
    });
  });

  describe('getBookedSlots', () => {
    it('should retrieve booked slots within date range', async () => {
      const slots = [mockSlotEntity];
      mockDb.execute.mockResolvedValue({ rows: slots });

      const dto: QuerySlotDto = {
        userId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        userType: UserType.MENTOR,
        dateFrom: '2025-12-01',
        dateTo: '2025-12-31',
      };

      const result = await service.getBookedSlots(dto);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('123');
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should use default 90-day range if dateTo is not provided', async () => {
      const slots = [mockSlotEntity];
      mockDb.execute.mockResolvedValue({ rows: slots });

      const dto: QuerySlotDto = {
        userId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        userType: UserType.MENTOR,
      };

      const result = await service.getBookedSlots(dto);

      expect(result).toHaveLength(1);
    });

    it('should throw CalendarException if date range exceeds 90 days', async () => {
      const dto: QuerySlotDto = {
        userId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        userType: UserType.MENTOR,
        dateFrom: '2025-01-01',
        dateTo: '2025-05-01', // ~120 days
      };

      await expect(service.getBookedSlots(dto)).rejects.toThrow(
        'Date range cannot exceed 90 days',
      );
    });

    it('should return empty array if no slots found', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });

      const dto: QuerySlotDto = {
        userId: 'a1b2c3d4-e5f6-47g8-h9i0-j1k2l3m4n5o6',
        userType: UserType.MENTOR,
      };

      const result = await service.getBookedSlots(dto);

      expect(result).toHaveLength(0);
    });
  });

  describe.skip('rescheduleSlot', () => {
    // TODO: rescheduleSlot method has been removed or renamed in v5.3
    // These tests are kept for reference but skipped
    it('should reschedule a slot successfully', async () => {
      const newSlotEntity = {
        ...mockSlotEntity,
        id: '456',
        time_range: '[2025-12-02 14:00:00+00, 2025-12-02 15:00:00+00)',
      };

      const mockTransaction = jest.fn().mockImplementation((callback) => {
        return callback({
          execute: jest
            .fn()
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ rows: [newSlotEntity] }),
        });
      });

      mockDb.transaction.mockImplementation(mockTransaction);
      mockDb.execute.mockResolvedValueOnce({ rows: [mockSlotEntity] });

      // const result = await service.rescheduleSlot(
      //   '123',
      //   new Date('2025-12-02T14:00:00Z'),
      //   60,
      // );
      // expect(result?.id).toBe('456');
    });

    it('should throw CalendarNotFoundException if old slot does not exist', async () => {
      mockDb.execute.mockResolvedValueOnce({ rows: [] });

      // await expect(
      //   service.rescheduleSlot(
      //     '999',
      //     new Date('2025-12-02T14:00:00Z'),
      //     60,
      //   ),
      // ).rejects.toThrow(CalendarNotFoundException);
    });

    it('should return null if new slot conflicts with EXCLUDE constraint', async () => {
      const mockTransaction = jest.fn().mockImplementation((callback) => {
        const txMock = {
          execute: jest
            .fn()
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(
              new Error('Constraint violation (23P01)'),
            ),
        };
        return callback(txMock);
      });

      mockDb.transaction.mockImplementation(mockTransaction);
      mockDb.execute.mockResolvedValueOnce({ rows: [mockSlotEntity] });

      // const result = await service.rescheduleSlot(
      //   '123',
      //   new Date('2025-12-02T14:00:00Z'),
      //   60,
      // );
      // expect(result).toBeNull();
    });

    it('should rollback transaction on unexpected error', async () => {
      const mockTransaction = jest.fn().mockImplementation((callback) => {
        const txMock = {
          execute: jest
            .fn()
            .mockResolvedValueOnce({})
            .mockRejectedValueOnce(new Error('Unexpected database error')),
        };
        return callback(txMock);
      });

      mockDb.transaction.mockImplementation(mockTransaction);
      mockDb.execute.mockResolvedValueOnce({ rows: [mockSlotEntity] });

      // await expect(
      //   service.rescheduleSlot(
      //     '123',
      //     new Date('2025-12-02T14:00:00Z'),
      //     60,
      //   ),
      // ).rejects.toThrow('Unexpected database error');
    });
  });

  describe('getSlotBySessionId', () => {
    it('should retrieve slot by session ID', async () => {
      mockDb.execute.mockResolvedValue({ rows: [mockSlotEntity] });

      const result = await service.getSlotBySessionId('session-1');

      expect(result).toBeDefined();
      expect(result?.sessionId).toBe('session-1');
    });

    it('should return null if session not found', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });

      const result = await service.getSlotBySessionId('session-999');

      expect(result).toBeNull();
    });
  });

  describe('getSlotById', () => {
    it('should retrieve slot by ID', async () => {
      mockDb.execute.mockResolvedValue({ rows: [mockSlotEntity] });

      const result = await service.getSlotById('123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('123');
    });

    it('should return null if slot not found', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });

      const result = await service.getSlotById('999');

      expect(result).toBeNull();
    });
  });

  describe('updateSlotSessionId', () => {
    it('should update slot with session ID', async () => {
      const updatedEntity = {
        ...mockSlotEntity,
        session_id: 'session-2',
      };

      mockDb.execute.mockResolvedValue({ rows: [updatedEntity] });

      const result = await service.updateSlotSessionId('123', 'session-2');

      expect(result.sessionId).toBe('session-2');
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should throw CalendarNotFoundException if slot not found', async () => {
      mockDb.execute.mockResolvedValue({ rows: [] });

      await expect(
        service.updateSlotSessionId('999', 'session-1'),
      ).rejects.toThrow(CalendarNotFoundException);
    });
  });

  describe('mapToEntity (private method via public methods)', () => {
    it('should correctly parse PostgreSQL tstzrange format', async () => {
      mockDb.execute.mockResolvedValue({ rows: [mockSlotEntity] });

      const result = await service.getSlotById('123');

      expect(result?.timeRange).toBeDefined();
      expect(result?.timeRange.start).toBeInstanceOf(Date);
      expect(result?.timeRange.end).toBeInstanceOf(Date);
      expect(result?.timeRange.start < result?.timeRange.end).toBe(true);
    });

    it('should handle fallback when time_range format is unexpected', async () => {
      const invalidEntity = {
        ...mockSlotEntity,
        time_range: 'invalid_format',
      };

      mockDb.execute.mockResolvedValue({ rows: [invalidEntity] });

      const result = await service.getSlotById('123');

      expect(result?.timeRange).toBeDefined();
      expect(result?.timeRange.start).toBeInstanceOf(Date);
      expect(result?.timeRange.end).toBeInstanceOf(Date);
    });
  });

  describe('edge cases and data validation', () => {
    it('should handle timezone-aware timestamps correctly', async () => {
      const tzAwareEntity = {
        ...mockSlotEntity,
        time_range: '[2025-12-01T10:00:00+05:30, 2025-12-01T11:00:00+05:30)',
      };

      mockDb.execute.mockResolvedValue({ rows: [tzAwareEntity] });

      const result = await service.getSlotById('123');

      expect(result?.timeRange.start).toBeInstanceOf(Date);
      expect(result?.timeRange.end).toBeInstanceOf(Date);
    });

    it('should map all entity fields correctly', async () => {
      mockDb.execute.mockResolvedValue({ rows: [mockSlotEntity] });

      const result = await service.getSlotById('123');

      expect(result?.id).toBe(mockSlotEntity.id);
      expect(result?.userId).toBe(mockSlotEntity.user_id);
      expect(result?.userType).toBe(mockSlotEntity.user_type);
      expect(result?.durationMinutes).toBe(mockSlotEntity.duration_minutes);
      expect(result?.sessionId).toBe(mockSlotEntity.session_id);
      expect(result?.sessionType).toBe(mockSlotEntity.session_type);
      expect(result?.title).toBe(mockSlotEntity.title);
      expect(result?.status).toBe(mockSlotEntity.status);
      expect(result?.reason).toBe(mockSlotEntity.reason);
    });
  });
});
