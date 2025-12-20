import { ClassEntity } from '../../entities/class.entity';
import { ClassStatus } from '../../value-objects/class-status.vo';
import { ClassType } from '../../value-objects/class-type.vo';

/**
 * Mapper - Class
 * Converts between Domain Entity and Persistence Model
 */
export class ClassMapper {
  /**
   * Convert database record to domain entity
   */
  static toDomain(record: any): ClassEntity {
    return new ClassEntity({
      id: record.id,
      name: record.name,
      type: record.type as ClassType,
      status: record.status as ClassStatus,
      startDate: new Date(record.start_date || record.startDate),
      endDate: new Date(record.end_date || record.endDate),
      description: record.description,
      totalSessions: record.total_sessions || record.totalSessions,
      createdByCounselorId: record.created_by_counselor_id || record.createdByCounselorId,
      createdAt: new Date(record.created_at || record.createdAt),
      updatedAt: new Date(record.updated_at || record.updatedAt),
    });
  }

  /**
   * Convert domain entity to persistence model
   */
  static toPersistence(entity: ClassEntity): any {
    return {
      id: entity.getId(),
      name: entity.getName(),
      type: entity.getType(),
      status: entity.getStatus(),
      startDate: entity.getStartDate(),
      endDate: entity.getEndDate(),
      description: entity.getDescription(),
      totalSessions: entity.getTotalSessions(),
      createdByCounselorId: entity.getCreatedByCounselorId(),
      createdAt: entity.getCreatedAt(),
      updatedAt: entity.getUpdatedAt(),
    };
  }
}

