import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Classes Module
import { ClassService } from './classes/services/class.service';
import { ClassQueryService } from './classes/services/class-query.service';
import { ClassRepository } from './classes/repositories/class.repository';

// Class Sessions Module
import { ClassSessionService } from './sessions/services/class-session.service';
import { ClassSessionQueryService } from './sessions/services/class-session-query.service';
import { ClassSessionRepository } from './sessions/repositories/class-session.repository';
import { ClassSessionEventListener } from './sessions/listeners/class-session-event.listener';

// Service Registry Module (shared across all service domains)
import { ServiceRegistryService } from '../service-registry/services/service-registry.service';
import { ServiceReferenceRepository } from '../service-registry/service-reference.repository';

@Module({
  imports: [DatabaseModule, EventEmitterModule],
  providers: [
    // Classes
    ClassService,
    ClassQueryService,
    ClassRepository,
    // Class Sessions
    ClassSessionService,
    ClassSessionQueryService,
    ClassSessionRepository,
    ClassSessionEventListener,
    // Service Registry
    ServiceRegistryService,
    ServiceReferenceRepository,
  ],
  exports: [
    // Classes
    ClassService,
    ClassQueryService,
    ClassRepository,
    // Class Sessions
    ClassSessionService,
    ClassSessionQueryService,
    ClassSessionRepository,
    // Service Registry
    ServiceRegistryService,
    ServiceReferenceRepository,
  ],
})
export class ClassSessionsModule {}

