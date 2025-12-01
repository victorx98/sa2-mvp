import { Injectable, Logger } from '@nestjs/common';
import { ClassRepository } from '../repositories/class.repository';
import { ClassEntity, ClassStatus, ClassType } from '../entities/class.entity';
import { ClassMentorPriceEntity } from '../entities/class-mentor-price.entity';
import { ClassStudentEntity } from '../entities/class-student.entity';
import { ClassCounselorEntity } from '../entities/class-counselor.entity';

export interface ClassFiltersDto {
  status?: ClassStatus;
  type?: ClassType;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ClassQueryService {
  private readonly logger = new Logger(ClassQueryService.name);

  constructor(private readonly classRepository: ClassRepository) {}

  /**
   * Get class list
   */
  async getClasses(filters: ClassFiltersDto = {}): Promise<ClassEntity[]> {
    const { limit = 10, offset = 0, ...queryFilters } = filters;
    this.logger.log(`Getting classes with filters: ${JSON.stringify(queryFilters)}`);

    return this.classRepository.findAll(limit, offset, queryFilters);
  }

  /**
   * Get class details (including related data)
   */
  async getClassById(id: string): Promise<any> {
    this.logger.log(`Getting class by ID: ${id}`);

    const classEntity = await this.classRepository.findByIdOrThrow(id);
    const mentors = await this.classRepository.getMentors(id);
    const students = await this.classRepository.getStudents(id);
    const counselors = await this.classRepository.getCounselors(id);

    return {
      ...classEntity,
      mentors,
      students,
      counselors,
    };
  }

  /**
   * Get mentors list for class
   */
  async getClassMentors(classId: string): Promise<ClassMentorPriceEntity[]> {
    this.logger.log(`Getting mentors for class: ${classId}`);
    return this.classRepository.getMentors(classId);
  }

  /**
   * Get students list for class
   */
  async getClassStudents(classId: string): Promise<ClassStudentEntity[]> {
    this.logger.log(`Getting students for class: ${classId}`);
    return this.classRepository.getStudents(classId);
  }

  /**
   * Get counselors list for class
   */
  async getClassCounselors(classId: string): Promise<ClassCounselorEntity[]> {
    this.logger.log(`Getting counselors for class: ${classId}`);
    return this.classRepository.getCounselors(classId);
  }
}

