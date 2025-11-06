import { Module } from '@nestjs/common';
import { CommonPortalModule } from './common-portal/common-portal.module';
import { CounselorPortalModule } from './counselor-portal/counselor-portal.module';

/**
 * Operations Layer - Root Module
 * 职责：聚合所有门户的 BFF Modules
 */
@Module({
  imports: [
    CommonPortalModule,
    CounselorPortalModule,
    // 未来可以添加其他门户：
    // StudentPortalModule,
    // MentorPortalModule,
  ],
  exports: [
    CommonPortalModule,
    CounselorPortalModule,
  ],
})
export class OperationsModule {}
