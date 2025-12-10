import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type {
  DrizzleDatabase,
  DrizzleTransaction,
} from '@shared/types/database.types';
import { Trace, addSpanAttributes, addSpanEvent } from '@shared/decorators/trace.decorator';
import { ClassService as DomainClassService } from '@domains/services/class-sessions/classes/services/class.service';
import { ClassStatus, ClassType } from '@domains/services/class-sessions/classes/entities/class.entity';

// DTOs
export interface CreateClassDto {
  name: string;
  type: ClassType;
  startDate: Date;
  endDate?: Date;
  description?: string;
  totalSessions?: number;
}

export interface UpdateClassDto {
  name?: string;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  totalSessions?: number;
}

export interface AddMentorDto {
  mentorUserId: string;
  pricePerSession: number;
}

export interface AddStudentDto {
  studentUserId: string;
}

export interface AddCounselorDto {
  counselorUserId: string;
}

/**
 * Application Layer - Class Management Service
 *
 * Responsibility:
 * - Orchestrate class creation, update, and member management
 * - Coordinate between Domain services
 * - Handle transaction management
 * - Validate business rules at application level
 */
@Injectable()
export class ClassService {
  private readonly logger = new Logger(ClassService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainClassService: DomainClassService,
  ) {}

  /**
   * Create a new class
   */
  @Trace({
    name: 'class.create',
    attributes: { 'operation.type': 'create' },
  })
  async createClass(dto: CreateClassDto) {
    const startTime = Date.now();

    this.logger.log(`Creating class: name=${dto.name}, type=${dto.type}`);

    addSpanAttributes({
      'class.name': dto.name,
      'class.type': dto.type,
    });

    try {
      addSpanEvent('class.creation.start');

      const classEntity = await this.domainClassService.createClass({
        name: dto.name,
        type: dto.type,
        startDate: dto.startDate,
        endDate: dto.endDate,
        description: dto.description,
        totalSessions: dto.totalSessions,
      } as any);

      const duration = Date.now() - startTime;
      this.logger.log(`Class created successfully in ${duration}ms: ${classEntity.id}`);
      addSpanEvent('class.creation.success');

      return {
        classId: classEntity.id,
        name: classEntity.name,
        type: classEntity.type,
        status: classEntity.status,
      };
    } catch (error) {
      this.logger.error(`Failed to create class: ${error.message}`, error.stack);
      addSpanEvent('class.creation.error');
      throw error;
    }
  }

  /**
   * Update class information
   */
  @Trace({
    name: 'class.update',
    attributes: { 'operation.type': 'update' },
  })
  async updateClass(classId: string, dto: UpdateClassDto) {
    this.logger.log(`Updating class: classId=${classId}`);
    addSpanAttributes({
      'class.id': classId,
      'update.fields': Object.keys(dto).join(','),
    });

    try {
      await this.domainClassService.updateClass(classId, dto as any);

      this.logger.log(`Class updated successfully: classId=${classId}`);
      addSpanEvent('class.update.success');

      return { classId, updated: true };
    } catch (error) {
      this.logger.error(`Failed to update class: ${error.message}`, error.stack);
      addSpanEvent('class.update.error');
      throw error;
    }
  }

  /**
   * Update class status
   */
  @Trace({
    name: 'class.update_status',
    attributes: { 'operation.type': 'update_status' },
  })
  async updateClassStatus(classId: string, status: ClassStatus) {
    this.logger.log(`Updating class status: classId=${classId}, status=${status}`);
    addSpanAttributes({
      'class.id': classId,
      'class.status': status,
    });

    try {
      await this.domainClassService.updateClassStatus(classId, status);

      this.logger.log(`Class status updated successfully: classId=${classId}`);
      addSpanEvent('class.update_status.success');

      return { classId, status };
    } catch (error) {
      this.logger.error(`Failed to update class status: ${error.message}`, error.stack);
      addSpanEvent('class.update_status.error');
      throw error;
    }
  }

  /**
   * Add mentor to class
   */
  @Trace({
    name: 'class.add_mentor',
    attributes: { 'operation.type': 'add_mentor' },
  })
  async addMentor(classId: string, dto: AddMentorDto) {
    this.logger.log(`Adding mentor to class: classId=${classId}, mentorId=${dto.mentorUserId}`);
    addSpanAttributes({
      'class.id': classId,
      'mentor.id': dto.mentorUserId,
      'mentor.price': dto.pricePerSession,
    });

    try {
      await this.domainClassService.addMentor(classId, dto.mentorUserId, dto.pricePerSession);

      this.logger.log(`Mentor added successfully to class: classId=${classId}`);
      addSpanEvent('class.add_mentor.success');

      return { classId, mentorId: dto.mentorUserId, added: true };
    } catch (error) {
      this.logger.error(`Failed to add mentor: ${error.message}`, error.stack);
      addSpanEvent('class.add_mentor.error');
      throw error;
    }
  }

  /**
   * Remove mentor from class
   */
  @Trace({
    name: 'class.remove_mentor',
    attributes: { 'operation.type': 'remove_mentor' },
  })
  async removeMentor(classId: string, mentorUserId: string) {
    this.logger.log(`Removing mentor from class: classId=${classId}, mentorId=${mentorUserId}`);
    addSpanAttributes({
      'class.id': classId,
      'mentor.id': mentorUserId,
    });

    try {
      await this.domainClassService.removeMentor(classId, mentorUserId);

      this.logger.log(`Mentor removed successfully from class: classId=${classId}`);
      addSpanEvent('class.remove_mentor.success');

      return { classId, mentorId: mentorUserId, removed: true };
    } catch (error) {
      this.logger.error(`Failed to remove mentor: ${error.message}`, error.stack);
      addSpanEvent('class.remove_mentor.error');
      throw error;
    }
  }

  /**
   * Update mentor price
   */
  @Trace({
    name: 'class.update_mentor_price',
    attributes: { 'operation.type': 'update_mentor_price' },
  })
  async updateMentorPrice(classId: string, mentorUserId: string, pricePerSession: number) {
    this.logger.log(`Updating mentor price: classId=${classId}, mentorId=${mentorUserId}, price=${pricePerSession}`);
    addSpanAttributes({
      'class.id': classId,
      'mentor.id': mentorUserId,
      'mentor.price': pricePerSession,
    });

    try {
      await this.domainClassService.updateMentorPrice(classId, mentorUserId, pricePerSession);

      this.logger.log(`Mentor price updated successfully: classId=${classId}`);
      addSpanEvent('class.update_mentor_price.success');

      return { classId, mentorId: mentorUserId, updated: true };
    } catch (error) {
      this.logger.error(`Failed to update mentor price: ${error.message}`, error.stack);
      addSpanEvent('class.update_mentor_price.error');
      throw error;
    }
  }

  /**
   * Add student to class
   */
  @Trace({
    name: 'class.add_student',
    attributes: { 'operation.type': 'add_student' },
  })
  async addStudent(classId: string, dto: AddStudentDto) {
    this.logger.log(`Adding student to class: classId=${classId}, studentId=${dto.studentUserId}`);
    addSpanAttributes({
      'class.id': classId,
      'student.id': dto.studentUserId,
    });

    try {
      await this.domainClassService.addStudent(classId, dto.studentUserId);

      this.logger.log(`Student added successfully to class: classId=${classId}`);
      addSpanEvent('class.add_student.success');

      return { classId, studentId: dto.studentUserId, added: true };
    } catch (error) {
      this.logger.error(`Failed to add student: ${error.message}`, error.stack);
      addSpanEvent('class.add_student.error');
      throw error;
    }
  }

  /**
   * Remove student from class
   */
  @Trace({
    name: 'class.remove_student',
    attributes: { 'operation.type': 'remove_student' },
  })
  async removeStudent(classId: string, studentUserId: string) {
    this.logger.log(`Removing student from class: classId=${classId}, studentId=${studentUserId}`);
    addSpanAttributes({
      'class.id': classId,
      'student.id': studentUserId,
    });

    try {
      await this.domainClassService.removeStudent(classId, studentUserId);

      this.logger.log(`Student removed successfully from class: classId=${classId}`);
      addSpanEvent('class.remove_student.success');

      return { classId, studentId: studentUserId, removed: true };
    } catch (error) {
      this.logger.error(`Failed to remove student: ${error.message}`, error.stack);
      addSpanEvent('class.remove_student.error');
      throw error;
    }
  }

  /**
   * Add counselor to class
   */
  @Trace({
    name: 'class.add_counselor',
    attributes: { 'operation.type': 'add_counselor' },
  })
  async addCounselor(classId: string, dto: AddCounselorDto) {
    this.logger.log(`Adding counselor to class: classId=${classId}, counselorId=${dto.counselorUserId}`);
    addSpanAttributes({
      'class.id': classId,
      'counselor.id': dto.counselorUserId,
    });

    try {
      await this.domainClassService.addCounselor(classId, dto.counselorUserId);

      this.logger.log(`Counselor added successfully to class: classId=${classId}`);
      addSpanEvent('class.add_counselor.success');

      return { classId, counselorId: dto.counselorUserId, added: true };
    } catch (error) {
      this.logger.error(`Failed to add counselor: ${error.message}`, error.stack);
      addSpanEvent('class.add_counselor.error');
      throw error;
    }
  }

  /**
   * Remove counselor from class
   */
  @Trace({
    name: 'class.remove_counselor',
    attributes: { 'operation.type': 'remove_counselor' },
  })
  async removeCounselor(classId: string, counselorUserId: string) {
    this.logger.log(`Removing counselor from class: classId=${classId}, counselorId=${counselorUserId}`);
    addSpanAttributes({
      'class.id': classId,
      'counselor.id': counselorUserId,
    });

    try {
      await this.domainClassService.removeCounselor(classId, counselorUserId);

      this.logger.log(`Counselor removed successfully from class: classId=${classId}`);
      addSpanEvent('class.remove_counselor.success');

      return { classId, counselorId: counselorUserId, removed: true };
    } catch (error) {
      this.logger.error(`Failed to remove counselor: ${error.message}`, error.stack);
      addSpanEvent('class.remove_counselor.error');
      throw error;
    }
  }

  /**
   * Get class details
   */
  async getClassById(classId: string) {
    this.logger.debug(`Fetching class details: classId=${classId}`);
    return this.domainClassService.getClassById(classId);
  }
}

