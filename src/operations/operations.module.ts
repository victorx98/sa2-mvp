import { Module } from '@nestjs/common';
import { CommonPortalModule } from './common-portal/common-portal.module';

/**
 * Operations Layer - Root Module
 * 职责：聚合所有门户的 BFF Modules
 */
@Module({
  imports: [
    CommonPortalModule,
    // 未来可以添加其他门户：
    // StudentPortalModule,
    // MentorPortalModule,
    // CounselorPortalModule,
  ],
  exports: [
    CommonPortalModule,
  ],
})
export class OperationsModule {}
