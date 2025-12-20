import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CommSessionDomainService } from './services/comm-session-domain.service';
import { COMM_SESSION_REPOSITORY } from './repositories/comm-session.repository.interface';
import { DrizzleCommSessionRepository } from './infrastructure/repositories/comm-session.repository';
import { CommSessionMapper } from './infrastructure/mappers/comm-session.mapper';

/**
 * Comm Sessions Module
 *
 * Provides domain services for internal communication sessions
 * Features:
 * - Not billable (no service registration)
 * - No completion event publishing
 * - Simplified lifecycle management
 */
@Module({
  imports: [DatabaseModule, EventEmitterModule],
  providers: [
    // Mapper
    CommSessionMapper,
    
    // Repository (dependency injection)
    {
      provide: COMM_SESSION_REPOSITORY,
      useClass: DrizzleCommSessionRepository,
    },
    
    // Domain Service
    CommSessionDomainService,
  ],
  exports: [
    COMM_SESSION_REPOSITORY,
    CommSessionDomainService,
  ],
})
export class CommSessionsModule {}

