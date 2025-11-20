import { MeetingProviderType, IMeetingInfo } from './provider.interface';

/**
 * Provider Interface Specification Tests
 *
 * Tests for interface contracts and type definitions
 */
describe('MeetingProviderType', () => {
  it('should have FEISHU enum value', () => {
    expect(MeetingProviderType.FEISHU).toBe('feishu');
  });

  it('should have ZOOM enum value', () => {
    expect(MeetingProviderType.ZOOM).toBe('zoom');
  });
});

describe('IMeetingInfo', () => {
  it('should have required properties', () => {
    const mockInfo: IMeetingInfo = {
      provider: MeetingProviderType.FEISHU,
      meetingId: 'vc_12345',
      meetingNo: '123456789',
      meetingUrl: 'https://feishu.cn/xxxx',
      meetingPassword: null,
      hostJoinUrl: null,
      startTime: new Date('2025-11-20T10:00:00Z'),
      duration: 60,
    };

    expect(mockInfo.provider).toBe(MeetingProviderType.FEISHU);
    expect(mockInfo.meetingId).toBe('vc_12345');
    expect(mockInfo.meetingNo).toBe('123456789');
    expect(mockInfo.meetingUrl).toBeTruthy();
    expect(mockInfo.duration).toBe(60);
  });

  it('should allow null values for optional fields', () => {
    const mockInfo: IMeetingInfo = {
      provider: MeetingProviderType.ZOOM,
      meetingId: 'zoom_xyz',
      meetingNo: null,
      meetingUrl: 'https://zoom.us/xxxx',
      meetingPassword: 'pass123',
      hostJoinUrl: 'https://zoom.us/host',
      startTime: new Date(),
      duration: 90,
    };

    expect(mockInfo.meetingNo).toBeNull();
    expect(mockInfo.meetingPassword).toBe('pass123');
    expect(mockInfo.hostJoinUrl).toBe('https://zoom.us/host');
  });
});

