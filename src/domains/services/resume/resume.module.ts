import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { ResumeDomainService } from './services/resume-domain.service';
import { ResumeRepository } from './infrastructure/repositories/resume.repository';
import { ResumeMapper } from './infrastructure/mappers/resume.mapper';
import { RESUME_REPOSITORY } from './repositories/resume.repository.interface';
import { ServiceRegistryModule } from '@domains/services/service-registry/service-registry.module';

@Module({
  imports: [
    DatabaseModule,
    ServiceRegistryModule,
  ],
  providers: [
    ResumeDomainService,
    ResumeMapper,
    {
      provide: RESUME_REPOSITORY,
      useClass: ResumeRepository,
    },
  ],
  exports: [
    RESUME_REPOSITORY,
    ResumeDomainService,
  ],
})
export class ResumeModule {}

