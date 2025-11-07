import { Module } from "@nestjs/common";
import { ApplicationModule } from "@application/application.module";
import { CounselorSessionsService } from "./sessions/sessions.service";

/**
 * Operations Layer - Counselor Portal Module
 * 职责：聚合顾问端的所有BFF服务
 *
 * 依赖：
 * - ApplicationModule: 提供Command、Query、Domain服务
 */
@Module({
  imports: [
    ApplicationModule, // Application层（包含Domain服务）
  ],
  providers: [
    // BFF Services
    CounselorSessionsService,
  ],
  exports: [CounselorSessionsService],
})
export class CounselorPortalModule {}
