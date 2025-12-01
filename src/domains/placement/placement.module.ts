import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";

import { DatabaseModule } from "@infrastructure/database/database.module";
import { JobPositionService } from "./services/job-position.service";
import { JobApplicationService } from "./services/job-application.service";

/**
 * Placement Domain Module [投岗域模块]
 * Provides business logic for placement operations including job position management,
 * application tracking, and referral processing
 * [提供投岗业务逻辑，包括岗位管理、投递跟踪和内推处理]
 */
@Module({
  imports: [DatabaseModule, EventEmitterModule.forRoot()],
  providers: [JobPositionService, JobApplicationService],
  exports: [JobPositionService, JobApplicationService],
})
export class PlacementModule {}

export default PlacementModule;
