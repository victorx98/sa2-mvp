import { Module } from "@nestjs/common";
import { SessionBffService } from "./session.service";
import { ApplicationModule } from "@application/application.module";

/**
 * Operations Layer - Session Module (BFF)
 */
@Module({
  imports: [ApplicationModule],
  providers: [SessionBffService],
  exports: [SessionBffService],
})
export class SessionBffModule {}
