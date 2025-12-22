import { ClassStatus, canActivate, canDeactivate } from '../value-objects/class-status.vo';
import { ClassType, isSessionType, isEnrollType } from '../value-objects/class-type.vo';
import { InvalidClassStateException } from '../exceptions/exceptions';

/**
 * Rich Domain Model - Class Entity
 * Encapsulates business logic and validation rules
 */
export class ClassEntity {
  private id: string;
  private name: string;
  private type: ClassType;
  private status: ClassStatus;
  private startDate: Date;
  private endDate: Date;
  private description?: string;
  private totalSessions: number;
  private createdByCounselorId?: string;
  private createdAt: Date;
  private updatedAt: Date;

  constructor(data: {
    id: string;
    name: string;
    type: ClassType;
    status: ClassStatus;
    startDate: Date;
    endDate: Date;
    description?: string;
    totalSessions: number;
    createdByCounselorId?: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    this.id = data.id;
    this.name = data.name;
    this.type = data.type;
    this.status = data.status;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.description = data.description;
    this.totalSessions = data.totalSessions;
    this.createdByCounselorId = data.createdByCounselorId;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;

    this.validate();
  }

  // Getters
  getId(): string { return this.id; }
  getName(): string { return this.name; }
  getType(): ClassType { return this.type; }
  getStatus(): ClassStatus { return this.status; }
  getStartDate(): Date { return this.startDate; }
  getEndDate(): Date { return this.endDate; }
  getDescription(): string | undefined { return this.description; }
  getTotalSessions(): number { return this.totalSessions; }
  getCreatedByCounselorId(): string | undefined { return this.createdByCounselorId; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }

  // Business logic methods
  isActive(): boolean {
    return this.status === ClassStatus.ACTIVE;
  }

  isSession(): boolean {
    return isSessionType(this.type);
  }

  isEnroll(): boolean {
    return isEnrollType(this.type);
  }

  /**
   * Activate the class
   */
  activate(): void {
    if (!canActivate(this.status)) {
      throw new InvalidClassStateException(
        `Cannot activate class in ${this.status} status`
      );
    }
    this.status = ClassStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Deactivate the class
   */
  deactivate(): void {
    if (!canDeactivate(this.status)) {
      throw new InvalidClassStateException(
        `Cannot deactivate class in ${this.status} status`
      );
    }
    this.status = ClassStatus.INACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Update class details
   */
  updateDetails(data: {
    name?: string;
    startDate?: Date;
    endDate?: Date;
    description?: string;
    totalSessions?: number;
  }): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.startDate !== undefined) this.startDate = data.startDate;
    if (data.endDate !== undefined) this.endDate = data.endDate;
    if (data.description !== undefined) this.description = data.description;
    if (data.totalSessions !== undefined) this.totalSessions = data.totalSessions;
    this.updatedAt = new Date();

    this.validate();
  }

  /**
   * Validate business rules
   */
  private validate(): void {
    if (this.endDate < this.startDate) {
      throw new InvalidClassStateException(
        'End date must be after start date'
      );
    }
    if (this.totalSessions < 0) {
      throw new InvalidClassStateException(
        'Total sessions must be non-negative'
      );
    }
  }
}

// Re-export for backward compatibility
export { ClassStatus, ClassType };
