import { Module } from '@nestjs/common';
import { RegularMentoringRepository } from './repositories/regular-mentoring.repository';
import { RegularMentoringService } from './services/regular-mentoring.service';
import { SessionTypesModule } from '@domains/services/session-types/session-types.module';
import { ServiceRegistryModule } from '@domains/services/service-registry/service-registry.module';

@Module({
  imports: [
    SessionTypesModule,
    ServiceRegistryModule,
  ],
  providers: [
    RegularMentoringRepository,
    RegularMentoringService,
  ],
  exports: [
    RegularMentoringService,
    RegularMentoringRepository,
  ],
})
export class RegularMentoringModule {}

