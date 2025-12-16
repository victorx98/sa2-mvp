import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { ResumeService } from './services/resume.service';
import { ResumeBillingService } from './services/resume-billing.service';
import { ResumeRepository } from './repositories/resume.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    ResumeService,
    ResumeBillingService,
    ResumeRepository,
  ],
  exports: [
    ResumeService,
    ResumeBillingService,
  ],
})
export class ResumeModule {}

