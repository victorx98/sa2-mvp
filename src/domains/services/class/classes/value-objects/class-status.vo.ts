/**
 * Class Status Value Object
 * Encapsulates business rules for class status
 */
export enum ClassStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

/**
 * Check if class can be activated
 */
export function canActivate(currentStatus: ClassStatus): boolean {
  return currentStatus === ClassStatus.INACTIVE;
}

/**
 * Check if class can be deactivated
 */
export function canDeactivate(currentStatus: ClassStatus): boolean {
  return currentStatus === ClassStatus.ACTIVE;
}

/**
 * Check if class is active
 */
export function isActive(status: ClassStatus): boolean {
  return status === ClassStatus.ACTIVE;
}

