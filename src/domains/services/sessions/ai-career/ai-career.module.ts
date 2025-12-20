import { Module } from '@nestjs/common';
import { AiCareerDomainService } from './services/ai-career-domain.service';
import { SessionTypesModule } from '@domains/services/session-types/session-types.module';
import { ServiceRegistryModule } from '@domains/services/service-registry/service-registry.module';
import { AI_CAREER_REPOSITORY } from './repositories/ai-career.repository.interface';
import { DrizzleAiCareerRepository } from './infrastructure/repositories/ai-career.repository';
import { AiCareerMapper } from './infrastructure/mappers/ai-career.mapper';

@Module({
  imports: [
    SessionTypesModule,
    ServiceRegistryModule,
  ],
  providers: [
    // Mapper
    AiCareerMapper,
    
    // Repository (dependency injection)
    {
      provide: AI_CAREER_REPOSITORY,
      useClass: DrizzleAiCareerRepository,
    },
    
    // Domain Service
    AiCareerDomainService,
  ],
  exports: [
    AI_CAREER_REPOSITORY,
    AiCareerDomainService,
  ],
})
export class AiCareerModule {}

