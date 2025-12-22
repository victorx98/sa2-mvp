/**
 * ServiceHold Module (服务预留模块)
 * Domain layer for service hold management (服务预留管理的域层)
 */

// Entities
export { ServiceHold } from './entities/service-hold.entity';
export {
  InvalidHoldQuantityException,
  HoldNotActiveException,
  HoldCannotExpireException,
  HoldAlreadyExistsException,
} from './entities/service-hold.entity';

// Value Objects
export { HoldStatus, InvalidHoldStatusException, InvalidHoldStatusTransitionException } from './value-objects/hold-status.vo';
