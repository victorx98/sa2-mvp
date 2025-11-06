import { Module } from "@nestjs/common";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { SessionService } from "./services/session.service";
import { SessionEventRepository } from "./repositories/session-event.repository";
import { SessionDurationCalculator } from "./services/session-duration-calculator";
import { SessionLifecycleService } from "./services/session-lifecycle.service";
import { SessionQueryService } from "./services/session-query.service";
import { SessionRecordingManager } from "./recording/session-recording-manager";
import { TranscriptPollingService } from "./recording/transcript-polling.service";
import { AISummaryService } from "./recording/ai-summary.service";

@Module({
  imports: [DatabaseModule],
  providers: [
    SessionService,
    SessionEventRepository,
    SessionDurationCalculator,
    SessionLifecycleService,
    SessionQueryService,
    SessionRecordingManager,
    TranscriptPollingService,
    AISummaryService,
  ],
  exports: [
    SessionService,
    SessionLifecycleService,
    SessionQueryService,
    SessionRecordingManager,
    TranscriptPollingService,
    AISummaryService,
  ],
})
export class SessionModule {}
