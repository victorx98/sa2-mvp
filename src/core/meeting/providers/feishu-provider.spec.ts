import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { FeishuMeetingProvider } from './feishu-provider';
import { FeishuMeetingClient } from './feishu-provider.client';
import { MeetingProviderType } from './provider.interface';
import {
  MeetingCreationFailedException,
  MeetingUpdateFailedException,
  MeetingNotFoundException,
} from '../exceptions/meeting.exception';

/**
 * Feishu Meeting Provider Tests
 */
describe('FeishuMeetingProvider', () => {
  let provider: FeishuMeetingProvider;
  let mockClient: jest.Mocked<FeishuMeetingClient>;

  beforeEach(async () => {
    mockClient = {
      applyReservation: jest.fn(),
      updateReservation: jest.fn(),
      deleteReservation: jest.fn(),
      getReservationInfo: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeishuMeetingProvider,
        {
          provide: FeishuMeetingClient,
          useValue: mockClient,
        },
      ],
    }).compile();

    provider = module.get<FeishuMeetingProvider>(FeishuMeetingProvider);
    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createMeeting', () => {
    it('should create a meeting successfully', async () => {
      const input = {
        topic: 'Weekly Standup',
        startTime: new Date('2025-11-20T10:00:00Z'),
        duration: 60,
        hostUserId: 'ou_xxxxx',
        autoRecord: true,
      };

      mockClient.applyReservation.mockResolvedValue({
        reserve: {
          id: 'reserve_123',
          meeting_no: '123456789',
          url: 'https://feishu.cn/meeting/123',
          live_link: 'https://feishu.cn/live/123',
          end_time: '1700000000',
        },
      });

      const result = await provider.createMeeting(input);

      expect(result.provider).toBe(MeetingProviderType.FEISHU);
      expect(result.meetingId).toBe('reserve_123');
      expect(result.meetingNo).toBe('123456789');
      expect(result.meetingUrl).toBe('https://feishu.cn/meeting/123');
      expect(result.duration).toBe(60);
      expect(mockClient.applyReservation).toHaveBeenCalled();
    });

    it('should throw error if hostUserId is missing', async () => {
      const input = {
        topic: 'Meeting',
        startTime: new Date(),
        duration: 60,
      };

      await expect(provider.createMeeting(input as any)).rejects.toThrow(
        MeetingCreationFailedException,
      );
    });

    it('should handle client errors', async () => {
      const input = {
        topic: 'Meeting',
        startTime: new Date(),
        duration: 60,
        hostUserId: 'ou_xxxxx',
      };

      mockClient.applyReservation.mockRejectedValue(
        new Error('API Error'),
      );

      await expect(provider.createMeeting(input)).rejects.toThrow(
        MeetingCreationFailedException,
      );
    });
  });

  describe('updateMeeting', () => {
    it('should update a meeting successfully', async () => {
      const meetingId = 'reserve_123';
      const input = {
        topic: 'Updated Title',
        duration: 90,
      };

      // Mock the getReservationInfo call used in updateMeeting
      mockClient.getReservationInfo.mockResolvedValue({
        reserve: {
          id: meetingId,
          meeting_no: '123456789',
          url: 'https://feishu.cn/meeting/123',
          live_link: 'https://feishu.cn/live/123',
          end_time: '1700000000',
          topic: 'Original Title',
          meeting_start_time: '2025-11-20T10:00:00Z',
          meeting_duration: 60,
          owner: { id: 'ou_xxxxx', user_type: 1 },
        },
      });

      mockClient.updateReservation.mockResolvedValue(undefined);

      const result = await provider.updateMeeting(meetingId, input);

      expect(result).toBe(true);
      expect(mockClient.updateReservation).toHaveBeenCalledWith(
        meetingId,
        expect.any(Object),
      );
    });

    it('should handle update errors', async () => {
      mockClient.updateReservation.mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(
        provider.updateMeeting('reserve_123', { topic: 'New Topic' }),
      ).rejects.toThrow(MeetingUpdateFailedException);
    });
  });

  describe('cancelMeeting', () => {
    it('should cancel a meeting successfully', async () => {
      const meetingId = 'reserve_123';

      mockClient.deleteReservation.mockResolvedValue(undefined);

      const result = await provider.cancelMeeting(meetingId);

      expect(result).toBe(true);
      expect(mockClient.deleteReservation).toHaveBeenCalledWith(meetingId);
    });
  });

  describe('getMeetingInfo', () => {
    it('should retrieve meeting info successfully', async () => {
      const meetingId = 'reserve_123';

      mockClient.getReservationInfo.mockResolvedValue({
        reserve: {
          id: 'reserve_123',
          meeting_no: '123456789',
          url: 'https://feishu.cn/meeting/123',
          live_link: 'https://feishu.cn/live/123',
          end_time: '1700000000',
          topic: 'Meeting Title',
          meeting_start_time: '2025-11-20T10:00:00Z',
          meeting_duration: 60,
          owner: {
            id: 'ou_xxxxx',
            user_type: 1,
          },
        },
      });

      const result = await provider.getMeetingInfo(meetingId);

      expect(result.provider).toBe(MeetingProviderType.FEISHU);
      expect(result.meetingId).toBe('reserve_123');
      expect(result.meetingNo).toBe('123456789');
      expect(result.duration).toBe(60);
    });

    it('should throw error for non-existent meeting', async () => {
      mockClient.getReservationInfo.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(
        provider.getMeetingInfo('non_existent'),
      ).rejects.toThrow(MeetingNotFoundException);
    });
  });
});

