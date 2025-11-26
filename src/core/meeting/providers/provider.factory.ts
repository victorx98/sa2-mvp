import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IMeetingProvider, MeetingProviderType } from "./provider.interface";
import { FeishuMeetingProvider } from "./feishu-provider";
import { ZoomMeetingProvider } from "./zoom-provider";
import { MeetingProviderException } from "../exceptions/meeting.exception";

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
    private readonly feishuProvider: FeishuMeetingProvider,
    private readonly zoomProvider: ZoomMeetingProvider,
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
        return this.feishuProvider;

      case MeetingProviderType.ZOOM:
        this.logger.debug("Returning Zoom meeting provider");
        return this.zoomProvider;

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

