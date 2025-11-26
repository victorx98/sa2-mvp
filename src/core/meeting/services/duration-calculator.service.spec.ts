import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DurationCalculatorService } from './duration-calculator.service';
import { MeetingEventEntity } from '../entities/meeting-event.entity';

/**
 * Duration Calculator Service Tests
 */
describe('DurationCalculatorService', () => {
  let service: DurationCalculatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DurationCalculatorService],
    }).compile();

    service = module.get<DurationCalculatorService>(DurationCalculatorService);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('calculateDuration', () => {
    it('should calculate duration from join/leave events', () => {
      const startTime = new Date('2025-11-20T10:00:00Z');
      const endTime = new Date('2025-11-20T11:00:00Z');

      const events: MeetingEventEntity[] = [
        {
          id: 'evt1',
          meetingNo: '123456789',
          meetingId: 'vc_xxxxx',
          eventId: 'event_1',
          eventType: 'vc.meeting.join_meeting_v1',
          provider: 'feishu',
          operatorId: 'ou_123',
          operatorRole: 1,
          meetingTopic: 'Meeting',
          meetingStartTime: startTime,
          meetingEndTime: null,
          eventData: {},
          occurredAt: startTime,
          createdAt: new Date(),
        },
        {
          id: 'evt2',
          meetingNo: '123456789',
          meetingId: 'vc_xxxxx',
          eventId: 'event_2',
          eventType: 'vc.meeting.leave_meeting_v1',
          provider: 'feishu',
          operatorId: 'ou_123',
          operatorRole: 1,
          meetingTopic: 'Meeting',
          meetingStartTime: null,
          meetingEndTime: endTime,
          eventData: {},
          occurredAt: endTime,
          createdAt: new Date(),
        },
      ];

      const result = service.calculateDuration(events);

      expect(result.durationSeconds).toBe(3600); // 1 hour
      expect(result.timeSegments.length).toBe(1);
      expect(result.timeSegments[0].start).toEqual(startTime);
      expect(result.timeSegments[0].end).toEqual(endTime);
    });

    it('should handle multiple join/leave cycles', () => {
      const t1 = new Date('2025-11-20T10:00:00Z');
      const t2 = new Date('2025-11-20T10:30:00Z');
      const t3 = new Date('2025-11-20T11:00:00Z');
      const t4 = new Date('2025-11-20T11:30:00Z');

      const events: MeetingEventEntity[] = [
        {
          id: 'evt1',
          eventType: 'vc.meeting.join_meeting_v1',
          occurredAt: t1,
          meetingNo: '123',
          meetingId: 'vc_1',
          eventId: 'e1',
          provider: 'feishu',
          operatorId: null,
          operatorRole: null,
          meetingTopic: null,
          meetingStartTime: null,
          meetingEndTime: null,
          eventData: {},
          createdAt: new Date(),
        },
        {
          id: 'evt2',
          eventType: 'vc.meeting.leave_meeting_v1',
          occurredAt: t2,
          meetingNo: '123',
          meetingId: 'vc_1',
          eventId: 'e2',
          provider: 'feishu',
          operatorId: null,
          operatorRole: null,
          meetingTopic: null,
          meetingStartTime: null,
          meetingEndTime: null,
          eventData: {},
          createdAt: new Date(),
        },
        {
          id: 'evt3',
          eventType: 'vc.meeting.join_meeting_v1',
          occurredAt: t3,
          meetingNo: '123',
          meetingId: 'vc_1',
          eventId: 'e3',
          provider: 'feishu',
          operatorId: null,
          operatorRole: null,
          meetingTopic: null,
          meetingStartTime: null,
          meetingEndTime: null,
          eventData: {},
          createdAt: new Date(),
        },
        {
          id: 'evt4',
          eventType: 'vc.meeting.leave_meeting_v1',
          occurredAt: t4,
          meetingNo: '123',
          meetingId: 'vc_1',
          eventId: 'e4',
          provider: 'feishu',
          operatorId: null,
          operatorRole: null,
          meetingTopic: null,
          meetingStartTime: null,
          meetingEndTime: null,
          eventData: {},
          createdAt: new Date(),
        },
      ];

      const result = service.calculateDuration(events);

      // 30 min + 30 min = 3600 seconds
      expect(result.durationSeconds).toBe(3600);
      expect(result.timeSegments.length).toBe(2);
    });

    it('should return zero duration for empty events', () => {
      const result = service.calculateDuration([]);

      expect(result.durationSeconds).toBe(0);
      expect(result.timeSegments).toEqual([]);
    });

    it('should handle non-join-leave events in mixed array', () => {
      const startTime = new Date('2025-11-20T10:00:00Z');
      const endTime = new Date('2025-11-20T11:00:00Z');

      const events: MeetingEventEntity[] = [
        {
          id: 'evt1',
          eventType: 'vc.meeting.meeting_started_v1',
          occurredAt: startTime,
          meetingNo: '123',
          meetingId: 'vc_1',
          eventId: 'e1',
          provider: 'feishu',
          operatorId: null,
          operatorRole: null,
          meetingTopic: null,
          meetingStartTime: null,
          meetingEndTime: null,
          eventData: {},
          createdAt: new Date(),
        },
        {
          id: 'evt2',
          eventType: 'vc.meeting.join_meeting_v1',
          occurredAt: startTime,
          meetingNo: '123',
          meetingId: 'vc_1',
          eventId: 'e2',
          provider: 'feishu',
          operatorId: null,
          operatorRole: null,
          meetingTopic: null,
          meetingStartTime: null,
          meetingEndTime: null,
          eventData: {},
          createdAt: new Date(),
        },
        {
          id: 'evt3',
          eventType: 'vc.meeting.leave_meeting_v1',
          occurredAt: endTime,
          meetingNo: '123',
          meetingId: 'vc_1',
          eventId: 'e3',
          provider: 'feishu',
          operatorId: null,
          operatorRole: null,
          meetingTopic: null,
          meetingStartTime: null,
          meetingEndTime: null,
          eventData: {},
          createdAt: new Date(),
        },
      ];

      const result = service.calculateDuration(events);

      expect(result.durationSeconds).toBe(3600);
      expect(result.timeSegments.length).toBe(1);
    });
  });

  describe('validateDuration', () => {
    it('should return true for valid duration', () => {
      const result = service.validateDuration(3600, 60); // 1 hour actual, 1 hour scheduled

      expect(result).toBe(true);
    });

    it('should return true for duration less than scheduled', () => {
      const result = service.validateDuration(1800, 60); // 30 min actual, 1 hour scheduled

      expect(result).toBe(true);
    });

    it('should return true for duration up to 3x scheduled', () => {
      const result = service.validateDuration(10800, 60); // 3 hours actual, 1 hour scheduled

      expect(result).toBe(true);
    });

    it('should return false for negative duration', () => {
      const result = service.validateDuration(-100, 60);

      expect(result).toBe(false);
    });

    it('should return false for duration exceeding 3x scheduled', () => {
      const result = service.validateDuration(11000, 60); // Over 3 hours

      expect(result).toBe(false);
    });
  });
});

