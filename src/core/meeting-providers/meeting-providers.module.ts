import { Module } from "@nestjs/common";
import { MeetingEventRepository } from "./repositories/meeting-event.repository";
import { MeetingEventService } from "./services/meeting-event.service";

/**
 * Meeting Providers Module
 *
 * Provides meeting event storage and management services
 * Used by Webhook Module to store events from Feishu/Zoom
 */
@Module({
  providers: [MeetingEventRepository, MeetingEventService],
  exports: [MeetingEventService],
})
export class MeetingProvidersModule {}

