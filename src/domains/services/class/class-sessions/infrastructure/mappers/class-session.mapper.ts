import { ClassSessionEntity, SessionType } from '../../entities/class-session.entity';
import { SessionStatus } from '../../value-objects/session-status.vo';

/**
 * Mapper - Class Session
 * Converts between Domain Entity and Persistence Model
 */
export class ClassSessionMapper {
  /**
   * Convert database record to domain entity
   */
  static toDomain(record: any): ClassSessionEntity {
    return new ClassSessionEntity({
      id: record.id,
      classId: record.class_id || record.classId,
      meetingId: record.meeting_id || record.meetingId,
      sessionType: (record.session_type || record.sessionType) as SessionType,
      serviceType: record.service_type || record.serviceType,
      mentorUserId: record.mentor_user_id || record.mentorUserId,
      createdByCounselorId: record.created_by_counselor_id || record.createdByCounselorId,
      title: record.title,
      description: record.description,
      status: record.status as SessionStatus,
      scheduledAt: new Date(record.scheduled_at || record.scheduledAt),
      completedAt: record.completed_at || record.completedAt ? new Date(record.completed_at || record.completedAt) : undefined,
      cancelledAt: record.cancelled_at || record.cancelledAt ? new Date(record.cancelled_at || record.cancelledAt) : undefined,
      deletedAt: record.deleted_at || record.deletedAt ? new Date(record.deleted_at || record.deletedAt) : undefined,
      aiSummaries: record.ai_summaries || record.aiSummaries || [],
      createdAt: new Date(record.created_at || record.createdAt),
      updatedAt: new Date(record.updated_at || record.updatedAt),
    });
  }

  /**
   * Convert domain entity to persistence model
   */
  static toPersistence(entity: ClassSessionEntity): any {
    return {
      id: entity.getId(),
      classId: entity.getClassId(),
      meetingId: entity.getMeetingId(),
      sessionType: entity.getSessionType(),
      serviceType: entity.getServiceType(),
      mentorUserId: entity.getMentorUserId(),
      createdByCounselorId: entity.getCreatedByCounselorId(),
      title: entity.getTitle(),
      description: entity.getDescription(),
      status: entity.getStatus(),
      scheduledAt: entity.getScheduledAt(),
      completedAt: entity.getCompletedAt() || null,
      cancelledAt: entity.getCancelledAt() || null,
      deletedAt: entity.getDeletedAt() || null,
      aiSummaries: entity.getAiSummaries(),
      createdAt: entity.getCreatedAt(),
      updatedAt: entity.getUpdatedAt(),
    };
  }
}

