import { Module } from "@nestjs/common";

import { DatabaseModule } from "@infrastructure/database/database.module";
import { MassApplicationService } from "./services/mass-application.service";

/**
 * Placement Domain Module [投岗域模块]
 * Provides business logic for placement operations including mass applications, proxy applications,
 * referral applications, and BD recommendations
 * [提供投岗业务逻辑，包括海投、代投、内推和BD推荐]
 */
@Module({
  imports: [DatabaseModule],
  providers: [MassApplicationService],
  exports: [MassApplicationService],
})
export class PlacementModule {}

export default PlacementModule;
