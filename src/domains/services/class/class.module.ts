import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Classes Module
import { ClassDomainService } from './classes/services/class-domain.service';
import { ClassRepository } from './classes/infrastructure/repositories/class.repository';
import { CLASS_REPOSITORY } from './classes/repositories/class.repository.interface';

// Class Sessions Module
import { ClassSessionDomainService } from './class-sessions/services/class-session-domain.service';
import { ClassSessionRepository } from './class-sessions/infrastructure/repositories/class-session.repository';
import { CLASS_SESSION_REPOSITORY } from './class-sessions/repositories/class-session.repository.interface';
import { ClassSessionEventListener } from './class-sessions/listeners/class-session-event.listener';

// Service Registry Module (shared across all service domains)
import { ServiceRegistryService } from '../service-registry/services/service-registry.service';
import { ServiceReferenceRepository } from '../service-registry/service-reference.repository';

@Module({
  imports: [DatabaseModule, EventEmitterModule],
  providers: [
    // Classes
    ClassDomainService,
    {
      provide: CLASS_REPOSITORY,
      useClass: ClassRepository,
    },
    // Class Sessions
    ClassSessionDomainService,
    {
      provide: CLASS_SESSION_REPOSITORY,
      useClass: ClassSessionRepository,
    },
    ClassSessionEventListener,
    // Service Registry
    ServiceRegistryService,
    ServiceReferenceRepository,
  ],
  exports: [
    // Classes
    ClassDomainService,
    CLASS_REPOSITORY,
    // Class Sessions
    ClassSessionDomainService,
    CLASS_SESSION_REPOSITORY,
    // Service Registry
    ServiceRegistryService,
    ServiceReferenceRepository,
  ],
})
export class ClassModule {}
