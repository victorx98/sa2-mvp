import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MeetingProviderFactory } from './provider.factory';
import { FeishuMeetingProvider } from './feishu-provider';
import { ZoomMeetingProvider } from './zoom-provider';
import { MeetingProviderType } from './provider.interface';
import { MeetingProviderException } from '../exceptions/meeting.exception';

/**
 * Meeting Provider Factory Tests
 */
describe('MeetingProviderFactory', () => {
  let factory: MeetingProviderFactory;
  let mockConfigService: jest.Mocked<ConfigService>;
  let feishuProvider: FeishuMeetingProvider;
  let zoomProvider: ZoomMeetingProvider;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'DEFAULT_MEETING_PROVIDER') {
          return 'feishu';
        }
        return undefined;
      }),
    } as any;

    feishuProvider = {} as FeishuMeetingProvider;
    zoomProvider = {} as ZoomMeetingProvider;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingProviderFactory,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: FeishuMeetingProvider,
          useValue: feishuProvider,
        },
        {
          provide: ZoomMeetingProvider,
          useValue: zoomProvider,
        },
      ],
    }).compile();

    factory = module.get<MeetingProviderFactory>(MeetingProviderFactory);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getProvider', () => {
    it('should return Feishu provider when FEISHU type is specified', () => {
      const provider = factory.getProvider(MeetingProviderType.FEISHU);
      expect(provider).toBe(feishuProvider);
    });

    it('should return Zoom provider when ZOOM type is specified', () => {
      const provider = factory.getProvider(MeetingProviderType.ZOOM);
      expect(provider).toBe(zoomProvider);
    });

    it('should throw error for unsupported provider type', () => {
      expect(() =>
        factory.getProvider('unknown' as MeetingProviderType),
      ).toThrow(MeetingProviderException);
    });
  });

  describe('getDefaultProvider', () => {
    it('should return default provider (Feishu)', () => {
      const provider = factory.getDefaultProvider();
      expect(provider).toBe(feishuProvider);
    });
  });

  describe('getDefaultProviderType', () => {
    it('should return default provider type', () => {
      const type = factory.getDefaultProviderType();
      expect(type).toBe(MeetingProviderType.FEISHU);
    });
  });

  describe('Invalid default provider configuration', () => {
    it('should fallback to Feishu if invalid default provider is configured', async () => {
      const invalidMockConfigService: any = {
        get: jest.fn((key: string) => {
          if (key === 'DEFAULT_MEETING_PROVIDER') {
            return 'invalid_provider';
          }
          return undefined;
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MeetingProviderFactory,
          {
            provide: ConfigService,
            useValue: invalidMockConfigService,
          },
          {
            provide: FeishuMeetingProvider,
            useValue: feishuProvider,
          },
          {
            provide: ZoomMeetingProvider,
            useValue: zoomProvider,
          },
        ],
      }).compile();

      const factoryWithInvalid = module.get<MeetingProviderFactory>(
        MeetingProviderFactory,
      );

      const type = factoryWithInvalid.getDefaultProviderType();
      expect(type).toBe(MeetingProviderType.FEISHU);
    });
  });
});

