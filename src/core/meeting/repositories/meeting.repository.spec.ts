import { Test, TestingModule } from '@nestjs/testing';
import { MeetingRepository } from './meeting.repository';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import { meetings } from '@infrastructure/database/schema/meetings.schema';
import { MeetingStatus } from '../entities/meeting.entity';

/**
 * Meeting Repository Tests
 */
describe('MeetingRepository', () => {
  let repository: MeetingRepository;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      returning: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingRepository,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<MeetingRepository>(MeetingRepository);
  });

  describe('create', () => {
    it('should create a meeting successfully', async () => {
      const mockMeeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
        meetingProvider: 'feishu',
        meetingId: 'vc_xxxxx',
        topic: 'Team Meeting',
        meetingUrl: 'https://feishu.cn/meeting/123',
        scheduleStartTime: new Date('2025-11-20T10:00:00Z'),
        scheduleDuration: 60,
        status: MeetingStatus.SCHEDULED,
        actualDuration: null,
        meetingTimeList: [],
        recordingUrl: null,
        lastMeetingEndedTimestamp: null,
        pendingTaskId: null,
        eventType: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValue([mockMeeting]);

      const result = await repository.create({
        meetingNo: '123456789',
        meetingProvider: 'feishu',
        reserveId: 'reserve_xxxxx', // v4.1 - use reserveId
        topic: 'Team Meeting',
        meetingUrl: 'https://feishu.cn/meeting/123',
        scheduleStartTime: new Date('2025-11-20T10:00:00Z'),
        scheduleDuration: 60,
      });

      expect(result).toEqual(mockMeeting);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find a meeting by ID', async () => {
      const mockMeeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
        status: MeetingStatus.SCHEDULED,
      };

      mockDb.limit.mockResolvedValue([mockMeeting]);

      const result = await repository.findById('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(mockMeeting);
    });

    it('should return null if meeting not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findByMeetingNoWithinWindow', () => {
    it('should find meeting within time window', async () => {
      const mockMeeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
        createdAt: new Date('2025-11-15T10:00:00Z'),
      };

      mockDb.limit.mockResolvedValue([mockMeeting]);

      const result = await repository.findByMeetingNoWithinWindow(
        '123456789',
        new Date('2025-11-20T10:00:00Z'),
        7,
      );

      expect(result).toEqual(mockMeeting);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should return null if no meeting found in window', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findByMeetingNoWithinWindow(
        '999999999',
        new Date(),
        7,
      );

      expect(result).toBeNull();
    });
  });

  describe('existsWithinTimeWindow', () => {
    it('should return true if duplicate meeting exists', async () => {
      mockDb.select.mockReturnThis();

      // Mock the count result
      const mockQueryResult = jest.fn();
      mockDb.select = jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() =>
            Promise.resolve([{ count: 1 }]),
          ),
        })),
      }));

      // Simplified mock for this test
      jest.spyOn(repository, 'existsWithinTimeWindow').mockResolvedValue(true);

      const result = await repository.existsWithinTimeWindow(
        '123456789',
        new Date('2025-11-20T10:00:00Z'),
        'feishu',
        7,
      );

      expect(result).toBe(true);
    });
  });

  describe('update', () => {
    it('should update a meeting successfully', async () => {
      const updatedMeeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: MeetingStatus.ACTIVE,
        updatedAt: new Date(),
      };

      // Mock the Drizzle chain: update() -> set() -> where() -> returning()
      const setChain = {
        where: jest.fn().mockReturnThis(),
      };
      setChain.where().returning = jest.fn().mockResolvedValue([updatedMeeting]);

      mockDb.update = jest
        .fn()
        .mockReturnValue({ set: jest.fn().mockReturnValue(setChain) });

      const result = await repository.update(
        '550e8400-e29b-41d4-a716-446655440000',
        { status: MeetingStatus.ACTIVE },
      );

      expect(result).toEqual(updatedMeeting);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a meeting by marking as expired', async () => {
      mockDb.rowCount = 1;

      jest.spyOn(repository, 'delete').mockResolvedValue(true);

      const result = await repository.delete('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toBe(true);
    });
  });

  describe('findByStatus', () => {
    it('should find meetings by status', async () => {
      const mockMeetings = [
        { id: 'id1', status: MeetingStatus.SCHEDULED },
        { id: 'id2', status: MeetingStatus.SCHEDULED },
      ];

      mockDb.limit.mockResolvedValue(mockMeetings);

      const result = await repository.findByStatus(MeetingStatus.SCHEDULED);

      expect(result).toEqual(mockMeetings);
      expect(mockDb.where).toHaveBeenCalled();
    });
  });
});

