// Classes
export { ClassEntity, ClassType, ClassStatus } from './classes/entities/class.entity';
export { ClassMentorPriceEntity } from './classes/entities/class-mentor-price.entity';
export { ClassStudentEntity } from './classes/entities/class-student.entity';
export { ClassCounselorEntity } from './classes/entities/class-counselor.entity';
export { ClassService } from './classes/services/class.service';
export { ClassQueryService, type ClassFiltersDto } from './classes/services/class-query.service';
export { CreateClassDto, type MentorPriceInput } from './classes/dto/create-class.dto';
export { UpdateClassDto } from './classes/dto/update-class.dto';
export { ClassRepository } from './classes/repositories/class.repository';

// Class Sessions
export { ClassSessionEntity, ClassSessionStatus, SessionType } from './class-sessions/entities/class-session.entity';
export { ClassSessionService } from './class-sessions/services/class-session.service';

export { CreateClassSessionDto } from './class-sessions/dto/create-class-session.dto';
export { UpdateClassSessionDto } from './class-sessions/dto/update-class-session.dto';
export { ClassSessionRepository } from './class-sessions/repositories/class-session.repository';
export { ClassSessionEventListener } from './class-sessions/listeners/class-session-event.listener';

// Service Registry (re-exported from shared module)
export { ServiceReferenceEntity } from '../service-registry/entities/service-reference.entity';
export { ServiceRegistryService } from '../service-registry/services/service-registry.service';
export { RegisterServiceDto } from '../service-registry/dto/register-service.dto';
export { ServiceReferenceRepository } from '../service-registry/service-reference.repository';

// Shared
export { ClassNotFoundException } from './shared/exceptions/class-not-found.exception';
export { ClassSessionNotFoundException } from './shared/exceptions/class-session-not-found.exception';

// Module
export { ClassModule } from './class.module';

