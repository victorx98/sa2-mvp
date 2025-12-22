import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { RecommLetterDomainService } from './services/recomm-letter-domain.service';
import { RecommLetterRepository } from './infrastructure/repositories/recomm-letter.repository';
import { RecommLetterMapper } from './infrastructure/mappers/recomm-letter.mapper';
import { RECOMM_LETTER_REPOSITORY } from './repositories/recomm-letter.repository.interface';
import { ServiceRegistryModule } from '@domains/services/service-registry/service-registry.module';

@Module({
  imports: [
    DatabaseModule,
    ServiceRegistryModule,
  ],
  providers: [
    RecommLetterDomainService,
    RecommLetterMapper,
    {
      provide: RECOMM_LETTER_REPOSITORY,
      useClass: RecommLetterRepository,
    },
  ],
  exports: [
    RECOMM_LETTER_REPOSITORY,
    RecommLetterDomainService,
  ],
})
export class RecommLetterModule {}

