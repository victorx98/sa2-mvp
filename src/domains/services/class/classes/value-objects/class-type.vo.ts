/**
 * Class Type Value Object
 * Defines different types of classes
 */
export enum ClassType {
  SESSION = 'session',  // Pay-per-session class
  ENROLL = 'enroll',    // Enrollment-based class
}

/**
 * Check if class is session-based
 */
export function isSessionType(type: ClassType): boolean {
  return type === ClassType.SESSION;
}

/**
 * Check if class is enrollment-based
 */
export function isEnrollType(type: ClassType): boolean {
  return type === ClassType.ENROLL;
}

