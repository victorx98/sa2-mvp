import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { ResumeService } from './services/resume.service';
import { ResumeRepository } from './repositories/resume.repository';
import { ServiceRegistryModule } from '@domains/services/service-registry/service-registry.module';

@Module({
  imports: [
    DatabaseModule,
    ServiceRegistryModule,
  ],
  providers: [
    ResumeService,
    ResumeRepository,
  ],
  exports: [
    ResumeService,
  ],
})
export class ResumeModule {}

