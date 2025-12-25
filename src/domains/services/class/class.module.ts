import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';

// Classes Module
import { ClassDomainService } from './classes/services/class-domain.service';
import { ClassRepository } from './classes/infrastructure/repositories/class.repository';
import { CLASS_REPOSITORY } from './classes/repositories/class.repository.interface';

// Class Sessions Module
import { ClassSessionDomainService } from './class-sessions/services/class-session-domain.service';
import { ClassSessionRepository } from './class-sessions/infrastructure/repositories/class-session.repository';
import { CLASS_SESSION_REPOSITORY } from './class-sessions/repositories/class-session.repository.interface';

// Service Registry Module (shared across all service domains)
import { ServiceRegistryService } from '../service-registry/services/service-registry.service';
import { ServiceReferenceRepository } from '../service-registry/service-reference.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    // Classes
    ClassDomainService,
    {
      provide: CLASS_REPOSITORY,
      useClass: ClassRepository,
    },
    ClassRepository,
    // Class Sessions
    ClassSessionDomainService,
    {
      provide: CLASS_SESSION_REPOSITORY,
      useClass: ClassSessionRepository,
    },
    ClassSessionRepository,
    // Service Registry
    ServiceRegistryService,
    ServiceReferenceRepository,
  ],
  exports: [
    // Classes
    ClassDomainService,
    CLASS_REPOSITORY,
    ClassRepository,
    // Class Sessions
    ClassSessionDomainService,
    CLASS_SESSION_REPOSITORY,
    ClassSessionRepository,
    // Service Registry
    ServiceRegistryService,
    ServiceReferenceRepository,
  ],
})
export class ClassModule {}
