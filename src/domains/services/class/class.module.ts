import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Classes Module
import { ClassService } from './classes/services/class.service';
import { ClassRepository } from './classes/repositories/class.repository';

// Class Sessions Module
import { ClassSessionService } from './class-sessions/services/class-session.service';
import { ClassSessionRepository } from './class-sessions/repositories/class-session.repository';
import { ClassSessionEventListener } from './class-sessions/listeners/class-session-event.listener';

// Service Registry Module (shared across all service domains)
import { ServiceRegistryService } from '../service-registry/services/service-registry.service';
import { ServiceReferenceRepository } from '../service-registry/service-reference.repository';

@Module({
  imports: [DatabaseModule, EventEmitterModule],
  providers: [
    // Classes
    ClassService,
    ClassRepository,
    // Class Sessions
    ClassSessionService,
    ClassSessionRepository,
    ClassSessionEventListener,
    // Service Registry
    ServiceRegistryService,
    ServiceReferenceRepository,
  ],
  exports: [
    // Classes
    ClassService,
    ClassRepository,
    // Class Sessions
    ClassSessionService,
    ClassSessionRepository,
    // Service Registry
    ServiceRegistryService,
    ServiceReferenceRepository,
  ],
})
export class ClassModule {}

