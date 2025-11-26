import { Module } from '@nestjs/common';
import { GapAnalysisRepository } from './gap-analysis.repository';
import { GapAnalysisService } from './services/gap-analysis.service';
import { GapAnalysisQueryService } from './services/gap-analysis-query.service';
import { GapAnalysisEventListener } from './listeners/gap-analysis-event.listener';
import { SessionTypesModule } from '@domains/services/session-types/session-types.module';
import { ServiceRegistryModule } from '@domains/services/service-registry/service-registry.module';

@Module({
  imports: [
    SessionTypesModule,
    ServiceRegistryModule,
  ],
  providers: [
    GapAnalysisRepository,
    GapAnalysisService,
    GapAnalysisQueryService,
    GapAnalysisEventListener,
  ],
  exports: [
    GapAnalysisService,
    GapAnalysisQueryService,
  ],
})
export class GapAnalysisModule {}

