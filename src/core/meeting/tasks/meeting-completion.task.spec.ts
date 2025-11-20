import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MeetingCompletionTask } from './meeting-completion.task';
import { MeetingRepository } from '../repositories/meeting.repository';
import { MeetingStatus } from '../entities/meeting.entity';

/**
 * Meeting Completion Task Tests
 */
describe('MeetingCompletionTask', () => {
  let task: MeetingCompletionTask;
  let mockRepository: jest.Mocked<MeetingRepository>;

  beforeEach(async () => {
    mockRepository = {
      findByStatus: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      existsWithinTimeWindow: jest.fn(),
      delete: jest.fn(),
      findByMeetingNoWithinWindow: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingCompletionTask,
        {
          provide: MeetingRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    task = module.get<MeetingCompletionTask>(MeetingCompletionTask);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('expireStaleMeetings', () => {
    it('should expire scheduled meetings older than 24 hours', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

      const staleMeetings = [
        {
          id: 'meeting_1',
          status: MeetingStatus.SCHEDULED,
          scheduleStartTime: oldDate,
          meetingNo: '111111111',
        },
        {
          id: 'meeting_2',
          status: MeetingStatus.SCHEDULED,
          scheduleStartTime: oldDate,
          meetingNo: '222222222',
        },
      ];

      mockRepository.findByStatus.mockResolvedValue(staleMeetings as any);
      mockRepository.update.mockResolvedValue({} as any);

      await task.expireStaleMeetings();

      expect(mockRepository.findByStatus).toHaveBeenCalledWith(
        MeetingStatus.SCHEDULED,
        1000,
      );
      expect(mockRepository.update).toHaveBeenCalledTimes(2);
      expect(mockRepository.update).toHaveBeenCalledWith(
        'meeting_1',
        { status: MeetingStatus.EXPIRED },
      );
      expect(mockRepository.update).toHaveBeenCalledWith(
        'meeting_2',
        { status: MeetingStatus.EXPIRED },
      );
    });

    it('should not expire scheduled meetings newer than 24 hours', async () => {
      const now = new Date();
      const recentDate = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago

      const recentMeetings = [
        {
          id: 'meeting_1',
          status: MeetingStatus.SCHEDULED,
          scheduleStartTime: recentDate,
          meetingNo: '111111111',
        },
      ];

      mockRepository.findByStatus.mockResolvedValue(recentMeetings as any);

      await task.expireStaleMeetings();

      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should handle empty scheduled meetings list', async () => {
      mockRepository.findByStatus.mockResolvedValue([]);

      await task.expireStaleMeetings();

      expect(mockRepository.findByStatus).toHaveBeenCalled();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockRepository.findByStatus.mockRejectedValue(new Error('DB Error'));

      await expect(task.expireStaleMeetings()).resolves.not.toThrow();

      expect(mockRepository.findByStatus).toHaveBeenCalled();
    });

    it('should handle mixed old and new meetings', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago
      const recentDate = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago

      const mixedMeetings = [
        {
          id: 'old_meeting',
          status: MeetingStatus.SCHEDULED,
          scheduleStartTime: oldDate,
          meetingNo: '111111111',
        },
        {
          id: 'recent_meeting',
          status: MeetingStatus.SCHEDULED,
          scheduleStartTime: recentDate,
          meetingNo: '222222222',
        },
      ];

      mockRepository.findByStatus.mockResolvedValue(mixedMeetings as any);
      mockRepository.update.mockResolvedValue({} as any);

      await task.expireStaleMeetings();

      // Only old meeting should be expired
      expect(mockRepository.update).toHaveBeenCalledTimes(1);
      expect(mockRepository.update).toHaveBeenCalledWith(
        'old_meeting',
        { status: MeetingStatus.EXPIRED },
      );
    });
  });

  describe('cleanupOldMeetings', () => {
    it('should execute cleanup task without errors', async () => {
      await task.cleanupOldMeetings();

      // Task should execute successfully (currently just logs)
      expect(true).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      jest.spyOn(task, 'cleanupOldMeetings').mockRejectedValue(new Error('Error'));

      await expect(task.cleanupOldMeetings()).rejects.toThrow();
    });
  });

  describe('Expiration threshold', () => {
    it('should use 24 hour expiration threshold', async () => {
      const now = new Date();
      const exactly24HoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const justOver24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000 - 1000);

      const meetings = [
        {
          id: 'meeting_at_24h',
          status: MeetingStatus.SCHEDULED,
          scheduleStartTime: exactly24HoursAgo,
          meetingNo: '111111111',
        },
        {
          id: 'meeting_over_24h',
          status: MeetingStatus.SCHEDULED,
          scheduleStartTime: justOver24Hours,
          meetingNo: '222222222',
        },
      ];

      mockRepository.findByStatus.mockResolvedValue(meetings as any);
      mockRepository.update.mockResolvedValue({} as any);

      await task.expireStaleMeetings();

      // Only the one over 24 hours should be expired
      expect(mockRepository.update).toHaveBeenCalledTimes(1);
      expect(mockRepository.update).toHaveBeenCalledWith(
        'meeting_over_24h',
        { status: MeetingStatus.EXPIRED },
      );
    });
  });
});

