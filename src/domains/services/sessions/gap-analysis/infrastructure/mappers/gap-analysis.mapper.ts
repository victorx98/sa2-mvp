import { Injectable } from '@nestjs/common';
import { GapAnalysisSession } from '../../entities/gap-analysis-session.entity';
import { SessionStatus, fromString } from '../../value-objects/session-status.vo';
import type { GapAnalysisSession as DbSession } from '@infrastructure/database/schema/gap-analysis-sessions.schema';

/**
 * Gap Analysis Mapper
 * 
 * Responsibility: Entity ↔ DB Record conversion
 */
@Injectable()
export class GapAnalysisMapper {
  /**
   * Database record → Domain entity
   */
  toDomain(record: DbSession): GapAnalysisSession {
    return GapAnalysisSession.reconstitute({
      id: record.id,
      meetingId: record.meetingId,
      sessionType: record.sessionType,
      sessionTypeId: record.sessionTypeId,
      serviceType: record.serviceType,
      serviceHoldId: record.serviceHoldId,
      studentUserId: record.studentUserId,
      mentorUserId: record.mentorUserId,
      createdByCounselorId: record.createdByCounselorId,
      title: record.title,
      description: record.description,
      status: fromString(record.status),
      scheduledAt: new Date(record.scheduledAt),
      completedAt: record.completedAt ? new Date(record.completedAt) : null,
      cancelledAt: record.cancelledAt ? new Date(record.cancelledAt) : null,
      deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
      aiSummaries: (record.aiSummaries as any) || [],
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
    });
  }

  /**
   * Domain entity → Database record
   */
  toPersistence(entity: GapAnalysisSession): Partial<DbSession> {
    return {
      id: entity.getId(),
      meetingId: entity.getMeetingId(),
      sessionType: entity.getSessionType(),
      sessionTypeId: entity.getSessionTypeId(),
      serviceType: entity.getServiceType(),
      serviceHoldId: entity.getServiceHoldId(),
      studentUserId: entity.getStudentUserId(),
      mentorUserId: entity.getMentorUserId(),
      createdByCounselorId: entity.getCreatedByCounselorId(),
      title: entity.getTitle(),
      description: entity.getDescription(),
      status: entity.getStatus(),
      scheduledAt: entity.getScheduledAt() as any,
      completedAt: entity.getCompletedAt() || null,
      cancelledAt: entity.getCancelledAt() || null,
      deletedAt: entity.getDeletedAt() || null,
      aiSummaries: entity.getAiSummaries(),
      updatedAt: new Date(),
    };
  }
}

