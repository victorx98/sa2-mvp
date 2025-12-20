import { Injectable, Logger, Inject } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ClassEntity } from '../entities/class.entity';
import { ClassStatus } from '../value-objects/class-status.vo';
import { ClassType } from '../value-objects/class-type.vo';
import { IClassRepository, CLASS_REPOSITORY } from '../repositories/class.repository.interface';
import {
  MentorAlreadyAssignedException,
  StudentAlreadyEnrolledException,
  CounselorAlreadyAssignedException,
} from '../exceptions/exceptions';

/**
 * Domain Service - Class
 * Pure business logic without external dependencies
 */
@Injectable()
export class ClassDomainService {
  private readonly logger = new Logger(ClassDomainService.name);

  constructor(
    @Inject(CLASS_REPOSITORY)
    private readonly repository: IClassRepository,
  ) {}

  /**
   * Create a new class entity
   */
  async createClass(data: {
    name: string;
    type: ClassType;
    startDate: Date;
    endDate: Date;
    description?: string;
    totalSessions: number;
    createdByCounselorId?: string;
  }): Promise<ClassEntity> {
    this.logger.log(`Creating class: ${data.name}`);

    const entity = new ClassEntity({
      id: randomUUID(),
      name: data.name,
      type: data.type,
      status: ClassStatus.ACTIVE,
      startDate: data.startDate,
      endDate: data.endDate,
      description: data.description,
      totalSessions: data.totalSessions,
      createdByCounselorId: data.createdByCounselorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await this.repository.create(entity);
    this.logger.log(`Class created: ${result.getId()}`);

    return result;
  }

  /**
   * Update class details
   */
  async updateClass(
    classId: string,
    data: {
      name?: string;
      startDate?: Date;
      endDate?: Date;
      description?: string;
      totalSessions?: number;
    },
  ): Promise<ClassEntity> {
    this.logger.log(`Updating class: ${classId}`);

    const classEntity = await this.repository.findByIdOrThrow(classId);
    classEntity.updateDetails(data);

    const result = await this.repository.save(classEntity);
    this.logger.log(`Class updated: ${classId}`);

    return result;
  }

  /**
   * Update class status
   */
  async updateClassStatus(classId: string, status: ClassStatus): Promise<ClassEntity> {
    this.logger.log(`Updating class status: ${classId} to ${status}`);

    const classEntity = await this.repository.findByIdOrThrow(classId);

    if (status === ClassStatus.ACTIVE) {
      classEntity.activate();
    } else if (status === ClassStatus.INACTIVE) {
      classEntity.deactivate();
    }

    const result = await this.repository.save(classEntity);
    this.logger.log(`Class status updated: ${classId}`);

    return result;
  }

  /**
   * Add mentor to class
   */
  async addMentor(classId: string, mentorId: string, pricePerSession: number): Promise<void> {
    this.logger.log(`Adding mentor ${mentorId} to class ${classId}`);

    await this.repository.findByIdOrThrow(classId);

    const hasMentor = await this.repository.hasMentor(classId, mentorId);
    if (hasMentor) {
      throw new MentorAlreadyAssignedException(mentorId, classId);
    }

    if (pricePerSession < 0) {
      throw new Error('Price per session must be non-negative');
    }

    await this.repository.addMentor(classId, mentorId, pricePerSession);
    this.logger.log(`Mentor added to class: ${classId}`);
  }

  /**
   * Remove mentor from class
   */
  async removeMentor(classId: string, mentorId: string): Promise<void> {
    this.logger.log(`Removing mentor ${mentorId} from class ${classId}`);

    await this.repository.findByIdOrThrow(classId);
    await this.repository.removeMentor(classId, mentorId);

    this.logger.log(`Mentor removed from class: ${classId}`);
  }

  /**
   * Add student to class
   */
  async addStudent(classId: string, studentId: string): Promise<void> {
    this.logger.log(`Adding student ${studentId} to class ${classId}`);

    await this.repository.findByIdOrThrow(classId);

    const hasStudent = await this.repository.hasStudent(classId, studentId);
    if (hasStudent) {
      throw new StudentAlreadyEnrolledException(studentId, classId);
    }

    await this.repository.addStudent(classId, studentId);
    this.logger.log(`Student added to class: ${classId}`);
  }

  /**
   * Remove student from class
   */
  async removeStudent(classId: string, studentId: string): Promise<void> {
    this.logger.log(`Removing student ${studentId} from class ${classId}`);

    await this.repository.findByIdOrThrow(classId);
    await this.repository.removeStudent(classId, studentId);

    this.logger.log(`Student removed from class: ${classId}`);
  }

  /**
   * Add counselor to class
   */
  async addCounselor(classId: string, counselorId: string): Promise<void> {
    this.logger.log(`Adding counselor ${counselorId} to class ${classId}`);

    await this.repository.findByIdOrThrow(classId);

    const hasCounselor = await this.repository.hasCounselor(classId, counselorId);
    if (hasCounselor) {
      throw new CounselorAlreadyAssignedException(counselorId, classId);
    }

    await this.repository.addCounselor(classId, counselorId);
    this.logger.log(`Counselor added to class: ${classId}`);
  }

  /**
   * Remove counselor from class
   */
  async removeCounselor(classId: string, counselorId: string): Promise<void> {
    this.logger.log(`Removing counselor ${counselorId} from class ${classId}`);

    await this.repository.findByIdOrThrow(classId);
    await this.repository.removeCounselor(classId, counselorId);

    this.logger.log(`Counselor removed from class: ${classId}`);
  }

  /**
   * Check if mentor is assigned to class
   */
  async hasMentor(classId: string, mentorId: string): Promise<boolean> {
    return this.repository.hasMentor(classId, mentorId);
  }

  /**
   * Check if student is enrolled in class
   */
  async hasStudent(classId: string, studentId: string): Promise<boolean> {
    return this.repository.hasStudent(classId, studentId);
  }

  /**
   * Check if counselor is assigned to class
   */
  async hasCounselor(classId: string, counselorId: string): Promise<boolean> {
    return this.repository.hasCounselor(classId, counselorId);
  }

  /**
   * Find class by ID
   */
  async findById(classId: string): Promise<ClassEntity | null> {
    return this.repository.findById(classId);
  }
}

