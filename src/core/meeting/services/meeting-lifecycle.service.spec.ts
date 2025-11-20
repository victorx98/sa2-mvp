import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MeetingLifecycleService } from './meeting-lifecycle.service';
import { MeetingRepository } from '../repositories/meeting.repository';
import { MeetingEventRepository } from '../repositories/meeting-event.repository';
import { DurationCalculatorService } from './duration-calculator.service';
import { DelayedTaskService } from './delayed-task.service';
import { MeetingStatus } from '../entities/meeting.entity';

/**
 * Meeting Lifecycle Service Tests
 */
describe('MeetingLifecycleService', () => {
  let service: MeetingLifecycleService;
  let mockMeetingRepo: jest.Mocked<MeetingRepository>;
  let mockEventRepo: jest.Mocked<MeetingEventRepository>;
  let mockDurationCalculator: jest.Mocked<DurationCalculatorService>;
  let mockDelayedTaskService: jest.Mocked<DelayedTaskService>;
  let mockEventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    mockMeetingRepo = {
      findById: jest.fn(),
      findByMeetingNoWithinWindow: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      existsWithinTimeWindow: jest.fn(),
      delete: jest.fn(),
      findByStatus: jest.fn(),
    } as any;

    mockEventRepo = {
      findByMeetingNo: jest.fn(),
      hasNewJoinEventsAfter: jest.fn(),
      create: jest.fn(),
      findByEventId: jest.fn(),
      findByMeetingId: jest.fn(),
      findJoinLeaveEvents: jest.fn(),
      findByMeetingNoAfterDate: jest.fn(),
    } as any;

    mockDurationCalculator = {
      calculateDuration: jest.fn(),
      validateDuration: jest.fn(),
    } as any;

    mockDelayedTaskService = {
      scheduleCompletionCheck: jest.fn(),
      cancelTask: jest.fn(),
      setLifecycleService: jest.fn(),
      getTaskInfo: jest.fn(),
      getPendingTasks: jest.fn(),
      cleanup: jest.fn(),
    } as any;

    mockEventEmitter = {
      emit: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingLifecycleService,
        {
          provide: MeetingRepository,
          useValue: mockMeetingRepo,
        },
        {
          provide: MeetingEventRepository,
          useValue: mockEventRepo,
        },
        {
          provide: DurationCalculatorService,
          useValue: mockDurationCalculator,
        },
        {
          provide: DelayedTaskService,
          useValue: mockDelayedTaskService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<MeetingLifecycleService>(MeetingLifecycleService);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleMeetingStarted', () => {
    it('should transition meeting from scheduled to active', async () => {
      const meeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
        status: MeetingStatus.SCHEDULED,
      };

      mockMeetingRepo.findByMeetingNoWithinWindow.mockResolvedValue(
        meeting as any,
      );
      mockMeetingRepo.update.mockResolvedValue({
        ...meeting,
        status: MeetingStatus.ACTIVE,
      } as any);

      await service.handleMeetingStarted('123456789', new Date());

      expect(mockMeetingRepo.update).toHaveBeenCalledWith(
        meeting.id,
        expect.objectContaining({ status: MeetingStatus.ACTIVE }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'meeting.status.changed',
        expect.any(Object),
      );
    });

    it('should skip transition if meeting already active', async () => {
      const meeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: MeetingStatus.ACTIVE,
      };

      mockMeetingRepo.findByMeetingNoWithinWindow.mockResolvedValue(
        meeting as any,
      );

      await service.handleMeetingStarted('123456789', new Date());

      expect(mockMeetingRepo.update).not.toHaveBeenCalled();
    });

    it('should handle meeting not found', async () => {
      mockMeetingRepo.findByMeetingNoWithinWindow.mockResolvedValue(null);

      await service.handleMeetingStarted('999999999', new Date());

      expect(mockMeetingRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('handleMeetingEnded', () => {
    it('should schedule delayed completion check', async () => {
      const meeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
        pendingTaskId: null,
      };

      const occurredAt = new Date();

      mockMeetingRepo.findByMeetingNoWithinWindow.mockResolvedValue(
        meeting as any,
      );
      mockDelayedTaskService.scheduleCompletionCheck.mockResolvedValue(
        'task_123',
      );
      mockMeetingRepo.update.mockResolvedValue({
        ...meeting,
        pendingTaskId: 'task_123',
      } as any);

      await service.handleMeetingEnded('123456789', occurredAt);

      expect(mockDelayedTaskService.scheduleCompletionCheck).toHaveBeenCalled();
      expect(mockMeetingRepo.update).toHaveBeenCalledWith(
        meeting.id,
        expect.objectContaining({ pendingTaskId: 'task_123' }),
      );
    });

    it('should cancel previous task if exists', async () => {
      const meeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
        pendingTaskId: 'old_task_id',
      };

      mockMeetingRepo.findByMeetingNoWithinWindow.mockResolvedValue(
        meeting as any,
      );
      mockDelayedTaskService.cancelTask.mockResolvedValue(true);
      mockDelayedTaskService.scheduleCompletionCheck.mockResolvedValue(
        'new_task_id',
      );
      mockMeetingRepo.update.mockResolvedValue({
        ...meeting,
        pendingTaskId: 'new_task_id',
      } as any);

      await service.handleMeetingEnded('123456789', new Date());

      expect(mockDelayedTaskService.cancelTask).toHaveBeenCalledWith(
        'old_task_id',
      );
    });
  });

  describe('finalizeMeeting', () => {
    it('should complete meeting when no new join events', async () => {
      const meeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
        meetingProvider: 'feishu',
        scheduleStartTime: new Date('2025-11-20T10:00:00Z'),
        scheduleDuration: 60,
        recordingUrl: null,
      };

      mockMeetingRepo.findById.mockResolvedValue(meeting as any);
      mockEventRepo.hasNewJoinEventsAfter.mockResolvedValue(false);
      mockEventRepo.findByMeetingNo.mockResolvedValue([]);
      mockDurationCalculator.calculateDuration.mockReturnValue({
        durationSeconds: 3600,
        timeSegments: [],
      });
      mockDurationCalculator.validateDuration.mockReturnValue(true);
      mockMeetingRepo.update.mockResolvedValue({
        ...meeting,
        status: MeetingStatus.ENDED,
        actualDuration: 3600,
      } as any);

      const lastEndedTimestamp = new Date();
      await service.finalizeMeeting(
        '550e8400-e29b-41d4-a716-446655440000',
        '123456789',
        lastEndedTimestamp,
      );

      expect(mockMeetingRepo.update).toHaveBeenCalledWith(
        meeting.id,
        expect.objectContaining({ status: MeetingStatus.ENDED }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'meeting.lifecycle.completed',
        expect.any(Object),
      );
    });

    it('should reschedule check if new join events detected', async () => {
      const meeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
        pendingTaskId: null,
      };

      mockMeetingRepo.findById.mockResolvedValue(meeting as any);
      mockEventRepo.hasNewJoinEventsAfter.mockResolvedValue(true);
      mockDelayedTaskService.scheduleCompletionCheck.mockResolvedValue(
        'new_task_id',
      );
      mockMeetingRepo.update.mockResolvedValue({
        ...meeting,
        pendingTaskId: 'new_task_id',
      } as any);

      const lastEndedTimestamp = new Date();
      await service.finalizeMeeting(
        meeting.id,
        meeting.meetingNo,
        lastEndedTimestamp,
      );

      expect(mockDelayedTaskService.scheduleCompletionCheck).toHaveBeenCalled();
      expect(mockMeetingRepo.update).toHaveBeenCalledWith(
        meeting.id,
        expect.objectContaining({ pendingTaskId: 'new_task_id' }),
      );
    });
  });

  describe('handleRecordingReady', () => {
    it('should update meeting with recording URL', async () => {
      const meeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
      };

      mockMeetingRepo.findByMeetingNoWithinWindow.mockResolvedValue(
        meeting as any,
      );
      mockMeetingRepo.update.mockResolvedValue({
        ...meeting,
        recordingUrl: 'https://feishu.cn/recording/123',
      } as any);

      await service.handleRecordingReady(
        '123456789',
        'https://feishu.cn/recording/123',
      );

      expect(mockMeetingRepo.update).toHaveBeenCalledWith(
        meeting.id,
        expect.objectContaining({
          recordingUrl: 'https://feishu.cn/recording/123',
        }),
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'meeting.recording.ready',
        expect.any(Object),
      );
    });

    it('should handle meeting not found', async () => {
      mockMeetingRepo.findByMeetingNoWithinWindow.mockResolvedValue(null);

      await service.handleRecordingReady(
        '999999999',
        'https://feishu.cn/recording/123',
      );

      expect(mockMeetingRepo.update).not.toHaveBeenCalled();
    });
  });
});

