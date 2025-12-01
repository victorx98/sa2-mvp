import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { MeetingManagerService } from './meeting-manager.service';
import { MeetingRepository } from '../repositories/meeting.repository';
import { MeetingProviderFactory } from '../providers/provider.factory';
import { IMeetingProvider, MeetingProviderType } from '../providers/provider.interface';
import { DuplicateMeetingException, InvalidMeetingStateException } from '../exceptions/meeting.exception';
import { MeetingStatus } from '../entities/meeting.entity';

/**
 * Meeting Manager Service Tests
 */
describe('MeetingManagerService', () => {
  let service: MeetingManagerService;
  let mockRepository: jest.Mocked<MeetingRepository>;
  let mockFactory: jest.Mocked<MeetingProviderFactory>;
  let mockProvider: jest.Mocked<IMeetingProvider>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      existsWithinTimeWindow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByStatus: jest.fn(),
    } as any;

    mockProvider = {
      createMeeting: jest.fn(),
      updateMeeting: jest.fn(),
      cancelMeeting: jest.fn(),
      getMeetingInfo: jest.fn(),
    };

    mockFactory = {
      getProvider: jest.fn().mockReturnValue(mockProvider),
      getDefaultProvider: jest.fn().mockReturnValue(mockProvider),
      getDefaultProviderType: jest.fn().mockReturnValue(MeetingProviderType.FEISHU),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingManagerService,
        {
          provide: MeetingRepository,
          useValue: mockRepository,
        },
        {
          provide: MeetingProviderFactory,
          useValue: mockFactory,
        },
      ],
    }).compile();

    service = module.get<MeetingManagerService>(MeetingManagerService);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createMeeting', () => {
    it('should create a meeting successfully', async () => {
      const dto = {
        topic: 'Team Meeting',
        startTime: '2025-11-20T10:00:00Z',
        duration: 60,
        hostUserId: 'ou_xxxxx',
      };

      mockProvider.createMeeting.mockResolvedValue({
        provider: MeetingProviderType.FEISHU,
        meetingId: 'reserve_12345',
        meetingNo: '123456789',
        meetingUrl: 'https://feishu.cn/meeting/123',
        meetingPassword: null,
        hostJoinUrl: null,
        startTime: new Date(dto.startTime),
        duration: dto.duration,
      });

      mockRepository.existsWithinTimeWindow.mockResolvedValue(false);

      const mockCreatedMeeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingNo: '123456789',
        status: MeetingStatus.SCHEDULED,
      };

      mockRepository.create.mockResolvedValue(mockCreatedMeeting as any);

      const result = await service.createMeeting(dto);

      expect(result.status).toBe(MeetingStatus.SCHEDULED);
      expect(mockProvider.createMeeting).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should throw error if duplicate meeting exists', async () => {
      const dto = {
        topic: 'Meeting',
        startTime: '2025-11-20T10:00:00Z',
        duration: 60,
        hostUserId: 'ou_xxxxx',
      };

      mockProvider.createMeeting.mockResolvedValue({
        provider: MeetingProviderType.FEISHU,
        meetingId: 'reserve_12345',
        meetingNo: '123456789',
        meetingUrl: 'https://feishu.cn/meeting/123',
        meetingPassword: null,
        hostJoinUrl: null,
        startTime: new Date(dto.startTime),
        duration: dto.duration,
      });

      mockRepository.existsWithinTimeWindow.mockResolvedValue(true);
      mockProvider.cancelMeeting.mockResolvedValue(true);

      await expect(service.createMeeting(dto)).rejects.toThrow(
        DuplicateMeetingException,
      );
    });
  });

  describe('updateMeeting', () => {
    it('should update a meeting successfully', async () => {
      const meetingId = '550e8400-e29b-41d4-a716-446655440000';
      const dto = {
        topic: 'Updated Topic',
        duration: 90,
      };

      const existingMeeting = {
        id: meetingId,
        status: MeetingStatus.SCHEDULED,
        meetingProvider: MeetingProviderType.FEISHU,
        meetingId: 'reserve_12345',
      };

      mockRepository.findById.mockResolvedValue(existingMeeting as any);
      mockProvider.updateMeeting.mockResolvedValue(true);

      const updatedMeeting = {
        ...existingMeeting,
        topic: 'Updated Topic',
      };

      mockRepository.update.mockResolvedValue(updatedMeeting as any);

      const result = await service.updateMeeting(meetingId, dto);

      expect(result).toEqual(updatedMeeting);
      expect(mockProvider.updateMeeting).toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalled();
    });

    it('should throw error if meeting is not in scheduled status', async () => {
      const meetingId = '550e8400-e29b-41d4-a716-446655440000';

      const meeting = {
        id: meetingId,
        status: MeetingStatus.ACTIVE,
      };

      mockRepository.findById.mockResolvedValue(meeting as any);

      await expect(
        service.updateMeeting(meetingId, { topic: 'New Topic' }),
      ).rejects.toThrow(InvalidMeetingStateException);
    });
  });

  describe('cancelMeeting', () => {
    it('should cancel a meeting successfully', async () => {
      const meetingId = '550e8400-e29b-41d4-a716-446655440000';

      const meeting = {
        id: meetingId,
        status: MeetingStatus.SCHEDULED,
        meetingProvider: MeetingProviderType.FEISHU,
        meetingId: 'reserve_12345',
      };

      mockRepository.findById.mockResolvedValue(meeting as any);
      mockProvider.cancelMeeting.mockResolvedValue(true);
      mockRepository.update.mockResolvedValue({
        ...meeting,
        status: MeetingStatus.CANCELLED,
      } as any);

      const result = await service.cancelMeeting(meetingId);

      expect(result).toBe(true);
      expect(mockProvider.cancelMeeting).toHaveBeenCalled();
      expect(mockRepository.update).toHaveBeenCalledWith(
        meetingId,
        expect.objectContaining({ status: MeetingStatus.CANCELLED }),
      );
    });

    it('should throw error if meeting not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(service.cancelMeeting('nonexistent')).rejects.toThrow(
        InvalidMeetingStateException,
      );
    });
  });

  describe('getMeetingById', () => {
    it('should retrieve meeting by ID', async () => {
      const meeting = { id: '550e8400-e29b-41d4-a716-446655440000' };

      mockRepository.findById.mockResolvedValue(meeting as any);

      const result = await service.getMeetingById('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual(meeting);
    });
  });

  describe('getMeetingInfo', () => {
    it('should return meeting info DTO', async () => {
      const meeting = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        meetingProvider: MeetingProviderType.FEISHU,
        meetingId: 'reserve_12345',
        meetingNo: '123456789',
        meetingUrl: 'https://feishu.cn/meeting/123',
        scheduleStartTime: new Date('2025-11-20T10:00:00Z'),
        scheduleDuration: 60,
      };

      mockRepository.findById.mockResolvedValue(meeting as any);

      const result = await service.getMeetingInfo('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toEqual({
        provider: MeetingProviderType.FEISHU,
        meetingId: 'reserve_12345',
        meetingNo: '123456789',
        meetingUrl: 'https://feishu.cn/meeting/123',
        startTime: meeting.scheduleStartTime,
        duration: 60,
        meetingPassword: null,
        hostJoinUrl: null,
      });
    });

    it('should return null if meeting not found', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await service.getMeetingInfo('nonexistent');

      expect(result).toBeNull();
    });
  });
});

