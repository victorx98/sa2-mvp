/**
 * Comm Sessions Module
 *
 * Exports from comm-sessions domain layer
 */

// Entities
export { CommSession } from './entities/comm-session.entity';

// Value Objects
export { SessionStatus } from './value-objects/session-status.vo';

// Services
export { CommSessionDomainService } from './services/comm-session-domain.service';

// Repository Interface
export { ICommSessionRepository, COMM_SESSION_REPOSITORY } from './repositories/comm-session.repository.interface';

// Exceptions
export * from './exceptions/exceptions';

