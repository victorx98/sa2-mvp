import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';
import { ClassRepository } from '../repositories/class.repository';
import { ClassEntity, ClassStatus, ClassType } from '../entities/class.entity';
import { CreateClassDto } from '../dto/create-class.dto';
import { UpdateClassDto } from '../dto/update-class.dto';
import { ClassNotFoundException } from '../../shared/exceptions/class-not-found.exception';
import { 
  CLASS_STUDENT_ADDED_EVENT, 
  CLASS_STUDENT_REMOVED_EVENT 
} from '@shared/events/event-constants';

@Injectable()
export class ClassService {
  private readonly logger = new Logger(ClassService.name);

  constructor(
    private readonly classRepository: ClassRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create class (only create classes record)
   * Mentors, students, and counselors insertion orchestrated by Application layer
   */
  async createClass(dto: CreateClassDto): Promise<ClassEntity> {
    this.logger.log(`Creating class: ${dto.name}, type: ${dto.type}`);

    const entity = new ClassEntity({
      id: uuidv4(),
      name: dto.name,
      type: dto.type,
      status: ClassStatus.ACTIVE,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      description: dto.description,
      totalSessions: dto.totalSessions,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await this.classRepository.create(entity);
    this.logger.log(`Class created successfully: ${result.id}`);

    return result;
  }

  /**
   * Update class information
   */
  async updateClass(id: string, dto: UpdateClassDto): Promise<ClassEntity> {
    this.logger.log(`Updating class: ${id}`);

    // Verify class exists
    await this.classRepository.findByIdOrThrow(id);

    const updates: Partial<ClassEntity> = {};
    if (dto.name) updates.name = dto.name;
    if (dto.startDate) updates.startDate = new Date(dto.startDate);
    if (dto.endDate) updates.endDate = new Date(dto.endDate);
    if (dto.description !== undefined) updates.description = dto.description;
    if (dto.totalSessions) updates.totalSessions = dto.totalSessions;

    const result = await this.classRepository.update(id, updates);
    this.logger.log(`Class updated successfully: ${id}`);

    return result;
  }

  /**
   * Update class status
   */
  async updateClassStatus(id: string, status: ClassStatus): Promise<void> {
    this.logger.log(`Updating class status: ${id}, status: ${status}`);

    // Verify class exists
    await this.classRepository.findByIdOrThrow(id);

    await this.classRepository.update(id, { status });
    this.logger.log(`Class status updated successfully: ${id}`);
  }

  /**
   * Add mentor
   */
  async addMentor(classId: string, mentorUserId: string, pricePerSession: number): Promise<void> {
    this.logger.log(`Adding mentor ${mentorUserId} to class ${classId}, price: ${pricePerSession}`);

    // Verify class exists
    await this.classRepository.findByIdOrThrow(classId);

    if (pricePerSession < 0) {
      throw new Error('Price per session must be non-negative');
    }

    await this.classRepository.addMentor(classId, mentorUserId, pricePerSession);
    this.logger.log(`Mentor added successfully to class ${classId}`);
  }

  /**
   * Remove mentor
   */
  async removeMentor(classId: string, mentorUserId: string): Promise<void> {
    this.logger.log(`Removing mentor ${mentorUserId} from class ${classId}`);

    // Verify class exists
    await this.classRepository.findByIdOrThrow(classId);

    // TODO: Verify that mentor cannot have incomplete sessions

    await this.classRepository.removeMentor(classId, mentorUserId);
    this.logger.log(`Mentor removed successfully from class ${classId}`);
  }

  /**
   * Update mentor price
   */
  async updateMentorPrice(classId: string, mentorUserId: string, pricePerSession: number): Promise<void> {
    this.logger.log(`Updating mentor price: classId=${classId}, mentorId=${mentorUserId}, price=${pricePerSession}`);

    // Verify class exists
    await this.classRepository.findByIdOrThrow(classId);

    if (pricePerSession < 0) {
      throw new Error('Price per session must be non-negative');
    }

    await this.classRepository.updateMentorPrice(classId, mentorUserId, pricePerSession);
    this.logger.log(`Mentor price updated successfully`);
  }

  /**
   * Add student
   */
  async addStudent(classId: string, studentUserId: string): Promise<void> {
    this.logger.log(`Adding student ${studentUserId} to class ${classId}`);

    // Verify class exists
    const classEntity = await this.classRepository.findByIdOrThrow(classId);

    await this.classRepository.addStudent(classId, studentUserId);
    this.logger.log(`Student added successfully to class ${classId}`);

    // Publish event
    const eventPayload = {
      classId: classEntity.id,
      name: classEntity.name,
      type: classEntity.type,
      status: classEntity.status,
      startDate: classEntity.startDate,
      endDate: classEntity.endDate,
      description: classEntity.description,
      totalSessions: classEntity.totalSessions,
      studentId: studentUserId,
      operatedAt: new Date(),
    };
    this.logger.log(`Publishing event: ${CLASS_STUDENT_ADDED_EVENT}, payload: ${JSON.stringify(eventPayload)}`);
    this.eventEmitter.emit(CLASS_STUDENT_ADDED_EVENT, eventPayload);
  }

  /**
   * Remove student
   */
  async removeStudent(classId: string, studentUserId: string): Promise<void> {
    this.logger.log(`Removing student ${studentUserId} from class ${classId}`);

    // Verify class exists
    const classEntity = await this.classRepository.findByIdOrThrow(classId);

    await this.classRepository.removeStudent(classId, studentUserId);
    this.logger.log(`Student removed successfully from class ${classId}`);

    // Publish event
    const eventPayload = {
      classId: classEntity.id,
      name: classEntity.name,
      type: classEntity.type,
      status: classEntity.status,
      startDate: classEntity.startDate,
      endDate: classEntity.endDate,
      description: classEntity.description,
      totalSessions: classEntity.totalSessions,
      studentId: studentUserId,
      operatedAt: new Date(),
    };
    this.logger.log(`Publishing event: ${CLASS_STUDENT_REMOVED_EVENT}, payload: ${JSON.stringify(eventPayload)}`);
    this.eventEmitter.emit(CLASS_STUDENT_REMOVED_EVENT, eventPayload);
  }

  /**
   * Add counselor
   */
  async addCounselor(classId: string, counselorUserId: string): Promise<void> {
    this.logger.log(`Adding counselor ${counselorUserId} to class ${classId}`);

    // Verify class exists
    await this.classRepository.findByIdOrThrow(classId);

    await this.classRepository.addCounselor(classId, counselorUserId);
    this.logger.log(`Counselor added successfully to class ${classId}`);
  }

  /**
   * Remove counselor
   */
  async removeCounselor(classId: string, counselorUserId: string): Promise<void> {
    this.logger.log(`Removing counselor ${counselorUserId} from class ${classId}`);

    // Verify class exists
    await this.classRepository.findByIdOrThrow(classId);

    await this.classRepository.removeCounselor(classId, counselorUserId);
    this.logger.log(`Counselor removed successfully from class ${classId}`);
  }

  /**
   * Get class details (for write operations validation)
   */
  async getClassById(id: string): Promise<ClassEntity> {
    this.logger.log(`Getting class by ID: ${id}`);
    return this.classRepository.findByIdOrThrow(id);
  }

  /**
   * Check if mentor is assigned to class (for write operations validation)
   */
  async hasMentor(classId: string, mentorId: string): Promise<boolean> {
    this.logger.log(`Checking if mentor ${mentorId} is in class ${classId}`);
    return this.classRepository.hasMentor(classId, mentorId);
  }
}

