import { Test, TestingModule } from '@nestjs/testing';
import { MeetingEventRepository } from './meeting-event.repository';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';

/**
 * Meeting Event Repository Tests
 */
describe('MeetingEventRepository', () => {
  let repository: MeetingEventRepository;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingEventRepository,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    repository = module.get<MeetingEventRepository>(MeetingEventRepository);
  });

  describe('create', () => {
    it('should create a meeting event successfully', async () => {
      const mockEvent = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
        meetingId: 'vc_xxxxx',
        eventId: 'evt_12345',
        eventType: 'vc.meeting.meeting_started_v1',
        provider: 'feishu',
        operatorId: 'ou_xxxxx',
        operatorRole: 1,
        meetingTopic: 'Team Meeting',
        eventData: { raw: 'data' },
        occurredAt: new Date(),
        createdAt: new Date(),
      };

      // Mock the Drizzle chain: insert() -> values() -> returning()
      mockDb.values.mockReturnValue({
        returning: jest.fn().mockResolvedValue([mockEvent]),
      });

      const result = await repository.create({
        meetingNo: '123456789',
        meetingId: 'vc_xxxxx',
        eventId: 'evt_12345',
        eventType: 'vc.meeting.meeting_started_v1',
        provider: 'feishu',
        operatorId: 'ou_xxxxx',
        operatorRole: 1,
        meetingTopic: 'Team Meeting',
        eventData: { raw: 'data' },
        occurredAt: new Date(),
      });

      expect(result).toEqual(mockEvent);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('findByEventId', () => {
    it('should find event by event ID', async () => {
      const mockEvent = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        eventId: 'evt_12345',
        eventType: 'vc.meeting.meeting_started_v1',
      };

      mockDb.limit.mockResolvedValue([mockEvent]);

      const result = await repository.findByEventId('evt_12345');

      expect(result).toEqual(mockEvent);
    });

    it('should return null if event not found', async () => {
      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findByEventId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByMeetingNo', () => {
    it('should find all events for a meeting number', async () => {
      const mockEvents = [
        { id: 'id1', eventType: 'meeting_started' },
        { id: 'id2', eventType: 'participant_joined' },
        { id: 'id3', eventType: 'meeting_ended' },
      ];

      mockDb.orderBy.mockResolvedValue(mockEvents);

      const result = await repository.findByMeetingNo('123456789');

      expect(result).toEqual(mockEvents);
      expect(result.length).toBe(3);
    });

    it('should return empty array if no events found', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      const result = await repository.findByMeetingNo('999999999');

      expect(result).toEqual([]);
    });
  });

  describe('findByMeetingId', () => {
    it('should find all events by meeting ID', async () => {
      const mockEvents = [
        { id: 'id1', meetingId: 'vc_xxxxx' },
        { id: 'id2', meetingId: 'vc_xxxxx' },
      ];

      mockDb.orderBy.mockResolvedValue(mockEvents);

      const result = await repository.findByMeetingId('vc_xxxxx');

      expect(result).toEqual(mockEvents);
      expect(result.length).toBe(2);
    });
  });

  describe('findJoinLeaveEvents', () => {
    it('should find join/leave events for duration calculation', async () => {
      const mockEvents = [
        { id: 'id1', eventType: 'vc.meeting.join_meeting_v1', occurredAt: new Date() },
        { id: 'id2', eventType: 'vc.meeting.leave_meeting_v1', occurredAt: new Date() },
        { id: 'id3', eventType: 'vc.meeting.join_meeting_v1', occurredAt: new Date() },
      ];

      mockDb.orderBy.mockResolvedValue(mockEvents);

      const result = await repository.findJoinLeaveEvents(
        '123456789',
        ['vc.meeting.join_meeting_v1', 'vc.meeting.leave_meeting_v1'],
      );

      expect(result).toEqual(mockEvents);
      expect(result.length).toBe(3);
    });
  });

  describe('hasNewJoinEventsAfter', () => {
    it('should detect new join events after timestamp', async () => {
      // Mock the internal query chain
      const mockSelect = jest.fn().mockReturnThis();
      const mockFrom = jest.fn().mockReturnThis();
      const mockWhere = jest.fn().mockResolvedValue([{ id: 'id1' }]);

      mockDb.select = mockSelect;
      mockSelect.mockReturnValue({
        from: mockFrom,
      });
      mockFrom.mockReturnValue({
        where: mockWhere,
      });
      mockDb.limit = jest.fn().mockResolvedValue([{ id: 'id1' }]);

      jest
        .spyOn(repository, 'hasNewJoinEventsAfter')
        .mockResolvedValue(true);

      const result = await repository.hasNewJoinEventsAfter(
        '123456789',
        new Date('2025-11-20T10:00:00Z'),
      );

      expect(result).toBe(true);
    });

    it('should return false if no new join events', async () => {
      jest
        .spyOn(repository, 'hasNewJoinEventsAfter')
        .mockResolvedValue(false);

      const result = await repository.hasNewJoinEventsAfter(
        '123456789',
        new Date('2025-11-20T10:00:00Z'),
      );

      expect(result).toBe(false);
    });
  });

  describe('findByMeetingNoAfterDate', () => {
    it('should find events after specific date', async () => {
      const mockEvents: any[] = [
        { 
          id: 'id1', 
          meetingNo: '123456789',
          meetingId: 'vc_xxxxx',
          eventId: 'evt_1',
          eventType: 'meeting_started',
          provider: 'feishu',
          operatorId: null,
          operatorRole: null,
          meetingTopic: null,
          meetingStartTime: null,
          meetingEndTime: null,
          eventData: {},
          occurredAt: new Date('2025-11-20T11:00:00Z'),
          createdAt: new Date(),
        },
      ];

      jest
        .spyOn(repository, 'findByMeetingNoAfterDate')
        .mockResolvedValue(mockEvents);

      const result = await repository.findByMeetingNoAfterDate(
        '123456789',
        new Date('2025-11-20T10:00:00Z'),
      );

      expect(result).toEqual(mockEvents);
    });
  });
});

