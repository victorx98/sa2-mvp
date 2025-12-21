import { Module } from '@nestjs/common';
import { GapAnalysisDomainService } from './services/gap-analysis-domain.service';
import { SessionTypesModule } from '@domains/services/session-types/session-types.module';
import { ServiceRegistryModule } from '@domains/services/service-registry/service-registry.module';
import { GAP_ANALYSIS_REPOSITORY } from './repositories/gap-analysis.repository.interface';
import { DrizzleGapAnalysisRepository } from './infrastructure/repositories/gap-analysis.repository';
import { GapAnalysisMapper } from './infrastructure/mappers/gap-analysis.mapper';

@Module({
  imports: [
    SessionTypesModule,
    ServiceRegistryModule,
  ],
  providers: [
    // Mapper
    GapAnalysisMapper,
    
    // Repository (dependency injection)
    {
      provide: GAP_ANALYSIS_REPOSITORY,
      useClass: DrizzleGapAnalysisRepository,
    },
    
    // Domain Service
    GapAnalysisDomainService,
  ],
  exports: [
    GAP_ANALYSIS_REPOSITORY,
    GapAnalysisDomainService,
  ],
})
export class GapAnalysisModule {}

