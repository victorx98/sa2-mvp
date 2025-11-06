import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { MeetingProviderFactory } from "./meeting-provider.factory";
import { FeishuMeetingAdapter } from "../feishu/feishu-meeting.adapter";
import { ZoomMeetingAdapter } from "../zoom/zoom-meeting.adapter";
import { MeetingProviderType } from "../interfaces/meeting-provider.interface";
import { MeetingProviderException } from "../exceptions/meeting-provider.exception";

describe("MeetingProviderFactory", () => {
  let factory: MeetingProviderFactory;
  let feishuAdapter: FeishuMeetingAdapter;
  let zoomAdapter: ZoomMeetingAdapter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeetingProviderFactory,
        {
          provide: FeishuMeetingAdapter,
          useValue: {
            createMeeting: jest.fn(),
            updateMeeting: jest.fn(),
            cancelMeeting: jest.fn(),
            getMeetingInfo: jest.fn(),
          },
        },
        {
          provide: ZoomMeetingAdapter,
          useValue: {
            createMeeting: jest.fn(),
            updateMeeting: jest.fn(),
            cancelMeeting: jest.fn(),
            getMeetingInfo: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "DEFAULT_MEETING_PROVIDER") {
                return "feishu";
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    factory = module.get<MeetingProviderFactory>(MeetingProviderFactory);
    feishuAdapter = module.get<FeishuMeetingAdapter>(FeishuMeetingAdapter);
    zoomAdapter = module.get<ZoomMeetingAdapter>(ZoomMeetingAdapter);
  });

  describe("getProvider", () => {
    it("should return Feishu adapter when provider type is feishu", () => {
      const provider = factory.getProvider(MeetingProviderType.FEISHU);
      expect(provider).toBe(feishuAdapter);
    });

    it("should return Zoom adapter when provider type is zoom", () => {
      const provider = factory.getProvider(MeetingProviderType.ZOOM);
      expect(provider).toBe(zoomAdapter);
    });

    it("should throw error for invalid provider type", () => {
      expect(() => {
        factory.getProvider("invalid" as MeetingProviderType);
      }).toThrow(MeetingProviderException);
    });
  });

  describe("getDefaultProvider", () => {
    it("should return default provider (Feishu)", () => {
      const provider = factory.getDefaultProvider();
      expect(provider).toBe(feishuAdapter);
    });
  });

  describe("getDefaultProviderType", () => {
    it("should return default provider type", () => {
      const providerType = factory.getDefaultProviderType();
      expect(providerType).toBe(MeetingProviderType.FEISHU);
    });
  });
});
