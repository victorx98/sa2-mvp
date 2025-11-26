import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

// Providers
import { FeishuMeetingClient } from "./providers/feishu-provider.client";
import { FeishuMeetingProvider } from "./providers/feishu-provider";
import { ZoomMeetingProvider } from "./providers/zoom-provider";
import { MeetingProviderFactory } from "./providers/provider.factory";

// Repositories
import { MeetingRepository } from "./repositories/meeting.repository";
import { MeetingEventRepository } from "./repositories/meeting-event.repository";

// Services
import { MeetingManagerService } from "./services/meeting-manager.service";
import { MeetingLifecycleService } from "./services/meeting-lifecycle.service";
import { MeetingEventService } from "./services/meeting-event.service";
import { DurationCalculatorService } from "./services/duration-calculator.service";
import { DelayedTaskService } from "./services/delayed-task.service";

// Tasks
import { MeetingCompletionTask } from "./tasks/meeting-completion.task";

/**
 * Meeting Module
 *
 * Core module for meeting resource management
 * Handles meeting lifecycle, event sourcing, and state management
 */
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  providers: [
    // Providers
    FeishuMeetingClient,
    FeishuMeetingProvider,
    ZoomMeetingProvider,
    MeetingProviderFactory,

    // Repositories
    MeetingRepository,
    MeetingEventRepository,

    // Services
    MeetingManagerService,
    MeetingLifecycleService,
    MeetingEventService,
    DurationCalculatorService,
    DelayedTaskService,

    // Tasks
    MeetingCompletionTask,
  ],
  exports: [
    // Export main services for use by other modules
    MeetingManagerService,
    MeetingEventService,
    MeetingProviderFactory,
  ],
})
export class MeetingModule {
  constructor(
    private readonly delayedTaskService: DelayedTaskService,
    private readonly lifecycleService: MeetingLifecycleService,
  ) {
    // Set lifecycle service in delayed task service to avoid circular dependency
    this.delayedTaskService.setLifecycleService(this.lifecycleService);
  }
}

