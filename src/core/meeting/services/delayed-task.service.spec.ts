import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DelayedTaskService } from './delayed-task.service';
import { MeetingLifecycleService } from './meeting-lifecycle.service';

/**
 * Delayed Task Service Tests
 */
describe('DelayedTaskService', () => {
  let service: DelayedTaskService;
  let mockScheduler: jest.Mocked<SchedulerRegistry>;
  let mockLifecycleService: jest.Mocked<MeetingLifecycleService>;

  beforeEach(async () => {
    mockScheduler = {
      addTimeout: jest.fn(),
      deleteTimeout: jest.fn(),
      getTimeouts: jest.fn().mockReturnValue([]),
    } as any;

    mockLifecycleService = {
      finalizeMeeting: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: DelayedTaskService,
          useFactory: () => {
            const taskService = new DelayedTaskService(mockScheduler);
            taskService.setLifecycleService(mockLifecycleService);
            return taskService;
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: mockScheduler,
        },
      ],
    }).compile();

    service = module.get<DelayedTaskService>(DelayedTaskService);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  describe('scheduleCompletionCheck', () => {
    it('should schedule a completion check task', async () => {
      const meetingId = '550e8400-e29b-41d4-a716-446655440000';
      const meetingNo = '123456789';
      const lastEndedTimestamp = new Date();

      const taskId = await service.scheduleCompletionCheck(
        meetingId,
        meetingNo,
        lastEndedTimestamp,
      );

      expect(taskId).toContain('completion-check');
      expect(mockScheduler.addTimeout).toHaveBeenCalled();

      // Clean up
      await service.cancelTask(taskId);
    });

    it('should return valid task ID', async () => {
      const taskId = await service.scheduleCompletionCheck(
        'meeting_1',
        '111111111',
        new Date(),
      );

      expect(taskId).toBeTruthy();
      expect(typeof taskId).toBe('string');

      await service.cancelTask(taskId);
    });

    it('should handle lifecycle service errors gracefully', async () => {
      const meetingId = '550e8400-e29b-41d4-a716-446655440000';
      const meetingNo = '123456789';
      const lastEndedTimestamp = new Date();

      mockLifecycleService.finalizeMeeting.mockRejectedValue(
        new Error('Service error'),
      );

      const taskId = await service.scheduleCompletionCheck(
        meetingId,
        meetingNo,
        lastEndedTimestamp,
      );

      // Task should be created despite potential future errors
      expect(taskId).toBeTruthy();

      await service.cancelTask(taskId);
    });
  });

  describe('cancelTask', () => {
    it('should cancel a scheduled task', async () => {
      jest.useFakeTimers();

      const taskId = await service.scheduleCompletionCheck(
        '550e8400-e29b-41d4-a716-446655440000',
        '123456789',
        new Date(),
      );

      const result = await service.cancelTask(taskId);

      expect(result).toBe(true);
      expect(mockScheduler.deleteTimeout).toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('should return false for non-existent task', async () => {
      const result = await service.cancelTask('nonexistent-task-id');

      expect(result).toBe(false);
    });

    it('should handle scheduler registry errors gracefully', async () => {
      jest.useFakeTimers();

      mockScheduler.deleteTimeout.mockImplementation(() => {
        throw new Error('Not in registry');
      });

      const taskId = await service.scheduleCompletionCheck(
        '550e8400-e29b-41d4-a716-446655440000',
        '123456789',
        new Date(),
      );

      const result = await service.cancelTask(taskId);

      expect(result).toBe(true); // Should still return true even if registry delete fails

      jest.useRealTimers();
    });
  });

  describe('getTaskInfo', () => {
    it('should return task info for pending task', async () => {
      jest.useFakeTimers();

      const meetingId = '550e8400-e29b-41d4-a716-446655440000';
      const meetingNo = '123456789';
      const scheduledAt = new Date();

      const taskId = await service.scheduleCompletionCheck(
        meetingId,
        meetingNo,
        scheduledAt,
      );

      const info = service.getTaskInfo(taskId);

      expect(info).not.toBeNull();
      expect(info?.meetingId).toBe(meetingId);
      expect(info?.meetingNo).toBe(meetingNo);

      jest.useRealTimers();
    });

    it('should return null for non-existent task', () => {
      const info = service.getTaskInfo('nonexistent');

      expect(info).toBeNull();
    });
  });

  describe('getPendingTasks', () => {
    it('should return all pending task IDs', async () => {
      jest.useFakeTimers();

      const taskId1 = await service.scheduleCompletionCheck(
        'meeting_1',
        '111111111',
        new Date(),
      );

      const taskId2 = await service.scheduleCompletionCheck(
        'meeting_2',
        '222222222',
        new Date(),
      );

      const pending = service.getPendingTasks();

      expect(pending).toContain(taskId1);
      expect(pending).toContain(taskId2);
      expect(pending.length).toBe(2);

      jest.useRealTimers();
    });

    it('should return empty array when no tasks pending', () => {
      const pending = service.getPendingTasks();

      expect(pending).toEqual([]);
    });
  });

  describe('cleanup', () => {
    it('should cleanup all pending tasks', async () => {
      jest.useFakeTimers();

      const taskId1 = await service.scheduleCompletionCheck(
        'meeting_1',
        '111111111',
        new Date(),
      );

      const taskId2 = await service.scheduleCompletionCheck(
        'meeting_2',
        '222222222',
        new Date(),
      );

      await service.cleanup();

      const pending = service.getPendingTasks();

      expect(pending).toEqual([]);
      expect(mockScheduler.deleteTimeout).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  describe('Task timing configuration', () => {
    it('should store task with correct meeting info', async () => {
      const meetingId = 'meeting_uuid';
      const meetingNo = '555555555';
      const scheduledAt = new Date();

      const taskId = await service.scheduleCompletionCheck(
        meetingId,
        meetingNo,
        scheduledAt,
      );

      const taskInfo = service.getTaskInfo(taskId);

      expect(taskInfo).not.toBeNull();
      expect(taskInfo?.meetingId).toBe(meetingId);
      expect(taskInfo?.meetingNo).toBe(meetingNo);

      await service.cancelTask(taskId);
    });
  });
});

