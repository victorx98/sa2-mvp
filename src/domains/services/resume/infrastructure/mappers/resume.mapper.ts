import { ResumeEntity } from '../../entities/resume.entity';
import { ResumeStatus } from '../../value-objects/resume-status.vo';
import type { Resume, NewResume } from '@infrastructure/database/schema';

/**
 * Resume Mapper
 * 
 * Maps between persistence model and domain entity
 */
export class ResumeMapper {
  // DB record -> Domain Entity
  static toDomain(record: Resume): ResumeEntity {
    return ResumeEntity.create({
      id: record.id,
      studentUserId: record.studentUserId,
      jobTitle: record.jobTitle,
      sessionType: record.sessionType,
      fileName: record.fileName,
      fileUrl: record.fileUrl,
      status: record.status as ResumeStatus,
      uploadedBy: record.uploadedBy,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      description: record.description ?? undefined,
      finalSetAt: record.finalSetAt ? new Date(record.finalSetAt) : undefined,
      mentorUserId: record.mentorUserId ?? undefined,
      billedBy: record.billedBy ?? undefined,
      billedAt: record.billedAt ? new Date(record.billedAt) : undefined,
    });
  }

  // Domain Entity -> DB record (for insert)
  static toPersistence(entity: ResumeEntity): Omit<NewResume, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      studentUserId: entity.getStudentUserId(),
      jobTitle: entity.getJobTitle(),
      sessionType: entity.getSessionType(),
      fileName: entity.getFileName(),
      fileUrl: entity.getFileUrl(),
      status: entity.getStatus(),
      uploadedBy: entity.getUploadedBy(),
      description: entity.getDescription() ?? null,
      finalSetAt: entity.getFinalSetAt() ?? null,
      mentorUserId: entity.getMentorUserId() ?? null,
      billedBy: entity.getBilledBy() ?? null,
      billedAt: entity.getBilledAt() ?? null,
    };
  }

  // Domain Entity -> DB record (for update)
  static toPersistenceForUpdate(entity: ResumeEntity): Partial<Resume> {
    return {
      id: entity.getId(),
      studentUserId: entity.getStudentUserId(),
      jobTitle: entity.getJobTitle(),
      sessionType: entity.getSessionType(),
      fileName: entity.getFileName(),
      fileUrl: entity.getFileUrl(),
      status: entity.getStatus(),
      uploadedBy: entity.getUploadedBy(),
      description: entity.getDescription() ?? null,
      finalSetAt: entity.getFinalSetAt() ?? null,
      mentorUserId: entity.getMentorUserId() ?? null,
      billedBy: entity.getBilledBy() ?? null,
      billedAt: entity.getBilledAt() ?? null,
      updatedAt: entity.getUpdatedAt(),
    };
  }
}

