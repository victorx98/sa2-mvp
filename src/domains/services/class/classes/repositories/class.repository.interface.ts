import { ClassEntity } from '../entities/class.entity';
import { ClassStatus } from '../value-objects/class-status.vo';
import { ClassType } from '../value-objects/class-type.vo';

/**
 * Repository Interface - Class
 * Defines contract for data access operations
 */
export interface IClassRepository {
  create(entity: ClassEntity): Promise<ClassEntity>;
  findById(id: string): Promise<ClassEntity | null>;
  findByIdOrThrow(id: string): Promise<ClassEntity>;
  findAll(
    limit?: number,
    offset?: number,
    filters?: {
      status?: ClassStatus;
      type?: ClassType;
      createdByCounselorId?: string;
      name?: string;
    },
    sortBy?: string,
    sortOrder?: 'asc' | 'desc'
  ): Promise<ClassEntity[]>;
  count(filters?: {
    status?: ClassStatus;
    type?: ClassType;
    createdByCounselorId?: string;
  }): Promise<number>;
  update(id: string, updates: Partial<ClassEntity>): Promise<ClassEntity>;
  save(entity: ClassEntity): Promise<ClassEntity>;
  
  // Mentor operations
  hasMentor(classId: string, mentorId: string): Promise<boolean>;
  addMentor(classId: string, mentorId: string, pricePerSession: number): Promise<void>;
  removeMentor(classId: string, mentorId: string): Promise<void>;
  getMentors(classId: string): Promise<any[]>;
  
  // Student operations
  hasStudent(classId: string, studentId: string): Promise<boolean>;
  addStudent(classId: string, studentId: string): Promise<void>;
  removeStudent(classId: string, studentId: string): Promise<void>;
  getStudents(classId: string, limit?: number, offset?: number): Promise<any[]>;
  countStudents(classId: string): Promise<number>;
  
  // Counselor operations
  hasCounselor(classId: string, counselorId: string): Promise<boolean>;
  addCounselor(classId: string, counselorId: string): Promise<void>;
  removeCounselor(classId: string, counselorId: string): Promise<void>;
  getCounselors(classId: string): Promise<any[]>;
}

export const CLASS_REPOSITORY = Symbol('CLASS_REPOSITORY');

