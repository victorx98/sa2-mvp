import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { SessionService } from "./services/session.service";
import { SessionEventRepository } from "./repositories/session-event.repository";
import { SessionDurationCalculator } from "./services/session-duration-calculator";
import { SessionQueryService } from "./services/session-query.service";
import { SessionRecordingManager } from "./recording/session-recording-manager";
import { TranscriptPollingService } from "./recording/transcript-polling.service";
import { AISummaryService } from "./recording/ai-summary.service";
import { SessionEventSubscriber } from "./subscribers/session-event.subscriber";

@Module({
  imports: [DatabaseModule, EventEmitterModule.forRoot()],
  providers: [
    // Core services
    SessionService,
    SessionEventRepository,
    SessionDurationCalculator,
    SessionQueryService,
    SessionRecordingManager,
    TranscriptPollingService,
    AISummaryService,

    // Event subscribers
    SessionEventSubscriber, // Subscribes to MeetingEventCreated events
  ],
  exports: [
    SessionService,
    SessionQueryService,
    SessionRecordingManager,
    TranscriptPollingService,
    AISummaryService,
    // Note: SessionEventSubscriber is not exported - it's auto-registered by @OnEvent
  ],
})
export class SessionModule {}
