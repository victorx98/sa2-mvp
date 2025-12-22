import { Module } from '@nestjs/common';
import { RegularMentoringDomainService } from './services/regular-mentoring-domain.service';
import { SessionTypesModule } from '@domains/services/session-types/session-types.module';
import { ServiceRegistryModule } from '@domains/services/service-registry/service-registry.module';
import { REGULAR_MENTORING_REPOSITORY } from './repositories/regular-mentoring.repository.interface';
import { DrizzleRegularMentoringRepository } from './infrastructure/repositories/regular-mentoring.repository';
import { RegularMentoringMapper } from './infrastructure/mappers/regular-mentoring.mapper';

@Module({
  imports: [
    SessionTypesModule,
    ServiceRegistryModule,
  ],
  providers: [
    // Mapper
    RegularMentoringMapper,
    
    // Repository (dependency injection)
    {
      provide: REGULAR_MENTORING_REPOSITORY,
      useClass: DrizzleRegularMentoringRepository,
    },
    
    // Domain Service
    RegularMentoringDomainService,
  ],
  exports: [
    REGULAR_MENTORING_REPOSITORY,
    RegularMentoringDomainService,
  ],
})
export class RegularMentoringModule {}

