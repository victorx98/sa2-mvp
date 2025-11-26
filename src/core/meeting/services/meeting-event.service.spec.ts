import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MeetingEventService } from './meeting-event.service';
import { MeetingEventRepository } from '../repositories/meeting-event.repository';
import { MeetingLifecycleService } from './meeting-lifecycle.service';

/**
 * Meeting Event Service Tests
 */
describe('MeetingEventService', () => {
  let service: MeetingEventService;
  let mockRepository: jest.Mocked<MeetingEventRepository>;
  let mockLifecycleService: jest.Mocked<MeetingLifecycleService>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findByEventId: jest.fn(),
      findByMeetingNo: jest.fn(),
      findByMeetingId: jest.fn(),
      findJoinLeaveEvents: jest.fn(),
      hasNewJoinEventsAfter: jest.fn(),
      findByMeetingNoAfterDate: jest.fn(),
    } as any;

    mockLifecycleService = {
      handleMeetingStarted: jest.fn(),
      handleMeetingEnded: jest.fn(),
      finalizeMeeting: jest.fn(),
      handleRecordingReady: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingEventService,
        {
          provide: MeetingEventRepository,
          useValue: mockRepository,
        },
        {
          provide: MeetingLifecycleService,
          useValue: mockLifecycleService,
        },
      ],
    }).compile();

    service = module.get<MeetingEventService>(MeetingEventService);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('recordEvent', () => {
    it('should record a new event and trigger lifecycle routing', async () => {
      const eventData = {
        meetingNo: '123456789',
        meetingId: 'vc_xxxxx',
        eventId: 'evt_123',
        eventType: 'vc.meeting.meeting_started_v1',
        provider: 'feishu',
        operatorId: 'ou_xxxxx',
        operatorRole: 1,
        meetingTopic: 'Team Meeting',
        eventData: { raw: 'data' },
        occurredAt: new Date(),
      };

      const mockCreatedEvent = {
        id: 'event_id_123',
        ...eventData,
        createdAt: new Date(),
      };

      mockRepository.findByEventId.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue(mockCreatedEvent as any);

      const result = await service.recordEvent(eventData);

      expect(result).toEqual(mockCreatedEvent);
      expect(mockRepository.findByEventId).toHaveBeenCalledWith('evt_123');
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should handle duplicate events (idempotency)', async () => {
      const eventData = {
        meetingNo: '123456789',
        meetingId: 'vc_xxxxx',
        eventId: 'evt_123',
        eventType: 'vc.meeting.meeting_started_v1',
        provider: 'feishu',
        operatorId: 'ou_xxxxx',
        operatorRole: 1,
        meetingTopic: 'Team Meeting',
        eventData: { raw: 'data' },
        occurredAt: new Date(),
      };

      const existingEvent = { id: 'event_id_123', ...eventData };

      mockRepository.findByEventId.mockResolvedValue(existingEvent as any);

      const result = await service.recordEvent(eventData);

      expect(result).toEqual(existingEvent);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should route meeting_started event to lifecycle service', async () => {
      const eventData = {
        meetingNo: '123456789',
        meetingId: 'vc_xxxxx',
        eventId: 'evt_123',
        eventType: 'vc.meeting.meeting_started_v1',
        provider: 'feishu',
        operatorId: 'ou_xxxxx',
        operatorRole: 1,
        meetingTopic: 'Team Meeting',
        eventData: {},
        occurredAt: new Date(),
      };

      mockRepository.findByEventId.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        id: 'event_id_123',
        ...eventData,
      } as any);

      mockLifecycleService.handleMeetingStarted.mockResolvedValue(undefined);

      await service.recordEvent(eventData);

      // Wait for setImmediate
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockLifecycleService.handleMeetingStarted).toHaveBeenCalledWith(
        '123456789',
        eventData.occurredAt,
      );
    });

    it('should route meeting_ended event to lifecycle service', async () => {
      const eventData = {
        meetingNo: '123456789',
        meetingId: 'vc_xxxxx',
        eventId: 'evt_456',
        eventType: 'vc.meeting.meeting_ended_v1',
        provider: 'feishu',
        operatorId: null,
        operatorRole: null,
        meetingTopic: null,
        eventData: {},
        occurredAt: new Date(),
      };

      mockRepository.findByEventId.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        id: 'event_id_456',
        ...eventData,
      } as any);

      mockLifecycleService.handleMeetingEnded.mockResolvedValue(undefined);

      await service.recordEvent(eventData);

      // Wait for setImmediate
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockLifecycleService.handleMeetingEnded).toHaveBeenCalledWith(
        '123456789',
        eventData.occurredAt,
      );
    });

    it('should route recording_ready event to lifecycle service', async () => {
      const eventData = {
        meetingNo: '123456789',
        meetingId: 'vc_xxxxx',
        eventId: 'evt_789',
        eventType: 'vc.meeting.recording_ready_v1',
        provider: 'feishu',
        operatorId: null,
        operatorRole: null,
        meetingTopic: null,
        eventData: {
          recording: {
            url: 'https://feishu.cn/recording/123',
          },
        },
        occurredAt: new Date(),
      };

      mockRepository.findByEventId.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        id: 'event_id_789',
        ...eventData,
      } as any);

      mockLifecycleService.handleRecordingReady.mockResolvedValue(undefined);

      await service.recordEvent(eventData);

      // Wait for setImmediate
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockLifecycleService.handleRecordingReady).toHaveBeenCalledWith(
        '123456789',
        'https://feishu.cn/recording/123',
      );
    });
  });

  describe('findByEventId', () => {
    it('should find event by event ID', async () => {
      const mockEvent = { id: 'event_id_123', eventId: 'evt_123' };

      mockRepository.findByEventId.mockResolvedValue(mockEvent as any);

      const result = await service.findByEventId('evt_123');

      expect(result).toEqual(mockEvent);
    });

    it('should return null if event not found', async () => {
      mockRepository.findByEventId.mockResolvedValue(null);

      const result = await service.findByEventId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByMeetingNo', () => {
    it('should find all events for a meeting number', async () => {
      const mockEvents = [
        { id: 'evt1', eventType: 'meeting_started' },
        { id: 'evt2', eventType: 'participant_joined' },
      ];

      mockRepository.findByMeetingNo.mockResolvedValue(mockEvents as any);

      const result = await service.findByMeetingNo('123456789');

      expect(result).toEqual(mockEvents);
      expect(result.length).toBe(2);
    });
  });

  describe('Recording URL extraction', () => {
    it('should extract Feishu recording URL', async () => {
      const eventData = {
        meetingNo: '123456789',
        meetingId: 'vc_xxxxx',
        eventId: 'evt_123',
        eventType: 'vc.meeting.recording_ready_v1',
        provider: 'feishu',
        operatorId: null,
        operatorRole: null,
        meetingTopic: null,
        eventData: {
          recording: {
            url: 'https://feishu.cn/recording/123',
          },
        },
        occurredAt: new Date(),
      };

      mockRepository.findByEventId.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        id: 'event_id_123',
        ...eventData,
      } as any);

      mockLifecycleService.handleRecordingReady.mockResolvedValue(undefined);

      await service.recordEvent(eventData);

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockLifecycleService.handleRecordingReady).toHaveBeenCalledWith(
        '123456789',
        'https://feishu.cn/recording/123',
      );
    });

    it('should extract Zoom recording URL', async () => {
      const eventData = {
        meetingNo: null,
        meetingId: '123456',
        eventId: 'evt_123',
        eventType: 'meeting.recording_completed',
        provider: 'zoom',
        operatorId: null,
        operatorRole: null,
        meetingTopic: null,
        eventData: {
          recording_files: [
            {
              download_url: 'https://zoom.us/recording/123',
            },
          ],
        },
        occurredAt: new Date(),
      };

      mockRepository.findByEventId.mockResolvedValue(null);
      mockRepository.create.mockResolvedValue({
        id: 'event_id_123',
        ...eventData,
      } as any);

      mockLifecycleService.handleRecordingReady.mockResolvedValue(undefined);

      await service.recordEvent(eventData);

      await new Promise((resolve) => setImmediate(resolve));

      expect(mockLifecycleService.handleRecordingReady).toHaveBeenCalledWith(
        null,
        'https://zoom.us/recording/123',
      );
    });
  });
});

