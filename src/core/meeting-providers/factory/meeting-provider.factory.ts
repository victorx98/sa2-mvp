import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  IMeetingProvider,
  MeetingProviderType,
} from "../interfaces/meeting-provider.interface";
import { FeishuMeetingAdapter } from "../feishu/feishu-meeting.adapter";
import { ZoomMeetingAdapter } from "../zoom/zoom-meeting.adapter";
import { MeetingProviderException } from "../exceptions/meeting-provider.exception";

/**
 * Meeting Provider Factory
 *
 * Factory class to get meeting provider instances based on provider type
 * Uses Strategy Pattern to support multiple meeting platforms
 */
@Injectable()
export class MeetingProviderFactory {
  private readonly logger = new Logger(MeetingProviderFactory.name);
  private readonly defaultProvider: MeetingProviderType;

  constructor(
    private readonly feishuAdapter: FeishuMeetingAdapter,
    private readonly zoomAdapter: ZoomMeetingAdapter,
    private readonly configService: ConfigService,
  ) {
    // Get default provider from environment
    const defaultProviderEnv =
      this.configService.get<string>("DEFAULT_MEETING_PROVIDER") || "feishu";

    // Validate and set default provider
    if (
      defaultProviderEnv !== MeetingProviderType.FEISHU &&
      defaultProviderEnv !== MeetingProviderType.ZOOM
    ) {
      this.logger.warn(
        `Invalid DEFAULT_MEETING_PROVIDER: ${defaultProviderEnv}. Using 'feishu' as default.`,
      );
      this.defaultProvider = MeetingProviderType.FEISHU;
    } else {
      this.defaultProvider = defaultProviderEnv as MeetingProviderType;
    }

    this.logger.log(`Default meeting provider: ${this.defaultProvider}`);
  }

  /**
   * Get meeting provider instance by type
   *
   * @param providerType - Provider type (feishu | zoom)
   * @returns Meeting provider instance
   * @throws MeetingProviderException if provider type is invalid
   */
  getProvider(providerType: MeetingProviderType): IMeetingProvider {
    switch (providerType) {
      case MeetingProviderType.FEISHU:
        this.logger.debug("Returning Feishu meeting provider");
        return this.feishuAdapter;

      case MeetingProviderType.ZOOM:
        this.logger.debug("Returning Zoom meeting provider");
        return this.zoomAdapter;

      default:
        throw new MeetingProviderException(
          `Unsupported meeting provider type: ${providerType}`,
        );
    }
  }

  /**
   * Get default meeting provider instance
   *
   * @returns Default meeting provider instance
   */
  getDefaultProvider(): IMeetingProvider {
    this.logger.debug(
      `Returning default meeting provider: ${this.defaultProvider}`,
    );
    return this.getProvider(this.defaultProvider);
  }

  /**
   * Get default provider type
   *
   * @returns Default provider type
   */
  getDefaultProviderType(): MeetingProviderType {
    return this.defaultProvider;
  }
}
