import { Module } from '@nestjs/common';
import { AiCareerRepository } from './repositories/ai-career.repository';
import { AiCareerService } from './services/ai-career.service';
import { AiCareerQueryService } from './services/ai-career-query.service';
import { AiCareerEventListener } from './listeners/ai-career-event.listener';
import { SessionTypesModule } from '@domains/services/session-types/session-types.module';
import { ServiceRegistryModule } from '@domains/services/service-registry/service-registry.module';

@Module({
  imports: [
    SessionTypesModule,
    ServiceRegistryModule,
  ],
  providers: [
    AiCareerRepository,
    AiCareerService,
    AiCareerQueryService,
    AiCareerEventListener,
  ],
  exports: [
    AiCareerService,
    AiCareerQueryService,
  ],
})
export class AiCareerModule {}

