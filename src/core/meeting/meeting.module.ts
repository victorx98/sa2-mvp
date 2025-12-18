import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

// Providers
import { FeishuMeetingClient } from "./providers/feishu-provider.client";
import { FeishuMeetingProvider } from "./providers/feishu-provider";
import { ZoomMeetingClient } from "./providers/zoom-provider.client";
import { ZoomMeetingProvider } from "./providers/zoom-provider";
import { MeetingProviderFactory } from "./providers/provider.factory";

// Repositories
import { MeetingRepository } from "./repositories/meeting.repository";
import { FeishuMeetingEventRepository } from "./repositories/feishu-meeting-event.repository";
import { ZoomMeetingEventRepository } from "./repositories/zoom-meeting-event.repository";

// Adapters
import { FeishuEventAdapter } from "./adapters/feishu-event.adapter";
import { ZoomEventAdapter } from "./adapters/zoom-event.adapter";

// Services
import { MeetingManagerService } from "./services/meeting-manager.service";
import { MeetingLifecycleService } from "./services/meeting-lifecycle.service";
import { UnifiedMeetingEventService } from "./services/unified-meeting-event.service";
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
    EventEmitterModule,
    ScheduleModule.forRoot(),
  ],
  providers: [
    // Providers
    FeishuMeetingClient,
    FeishuMeetingProvider,
    ZoomMeetingClient,
    ZoomMeetingProvider,
    MeetingProviderFactory,

    // Repositories
    MeetingRepository,
    FeishuMeetingEventRepository,
    ZoomMeetingEventRepository,

    // Adapters
    FeishuEventAdapter,
    ZoomEventAdapter,

    // Services
    MeetingManagerService,
    MeetingLifecycleService,
    UnifiedMeetingEventService,
    DurationCalculatorService,
    DelayedTaskService,

    // Tasks
    MeetingCompletionTask,
  ],
  exports: [
    // Export main services for use by other modules
    MeetingManagerService,
    UnifiedMeetingEventService,
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
