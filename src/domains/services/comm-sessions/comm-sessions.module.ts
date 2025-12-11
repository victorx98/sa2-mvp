import { Module } from '@nestjs/common';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Comm Sessions Module
import { CommSessionService } from './services/comm-session.service';
import { CommSessionRepository } from './repositories/comm-session.repository';
import { CommSessionEventListener } from './listeners/comm-session-event.listener';

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
    CommSessionService,
    CommSessionRepository,
    CommSessionEventListener,
  ],
  exports: [CommSessionService, CommSessionRepository],
})
export class CommSessionsModule {}

