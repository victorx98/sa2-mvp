import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { FeishuMeetingClient } from "./feishu/feishu-meeting.client";
import { FeishuMeetingAdapter } from "./feishu/feishu-meeting.adapter";
import { ZoomMeetingClient } from "./zoom/zoom-meeting.client";
import { ZoomMeetingAdapter } from "./zoom/zoom-meeting.adapter";
import { MeetingProviderFactory } from "./factory/meeting-provider.factory";

/**
 * Meeting Provider Module
 *
 * Provides meeting platform integration (Feishu, Zoom, etc.)
 * Uses Strategy Pattern + Factory Pattern for extensibility
 */
@Module({
  imports: [ConfigModule],
  providers: [
    // Feishu providers
    FeishuMeetingClient,
    FeishuMeetingAdapter,

    // Zoom providers
    ZoomMeetingClient,
    ZoomMeetingAdapter,

    // Factory
    MeetingProviderFactory,
  ],
  exports: [
    // Export factory for other modules to use
    MeetingProviderFactory,

    // Also export individual adapters if needed
    FeishuMeetingAdapter,
    ZoomMeetingAdapter,
  ],
})
export class MeetingProviderModule {}
