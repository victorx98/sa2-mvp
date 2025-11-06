import { Module } from '@nestjs/common';
import { ApplicationModule } from '@application/application.module';
import { SessionModule } from '@domains/services/session/session.module';
import { ContractModule } from '@domains/contract/contract.module';
import { CounselorSessionsService } from './sessions/sessions.service';

/**
 * Operations Layer - Counselor Portal Module
 * 职责：聚合顾问端的所有BFF服务
 *
 * 依赖：
 * - ApplicationModule: 提供UseCase和Query
 * - SessionModule: 提供Session Domain服务
 * - ContractModule: 提供Contract Domain服务（余额查询）
 */
@Module({
  imports: [
    ApplicationModule, // Application层
    SessionModule, // Domain层：Session
    ContractModule, // Domain层：Contract
  ],
  providers: [
    // BFF Services
    CounselorSessionsService,
  ],
  exports: [
    CounselorSessionsService,
  ],
})
export class CounselorPortalModule {}
