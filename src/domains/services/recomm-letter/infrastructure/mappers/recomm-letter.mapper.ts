import { RecommLetterEntity } from '../../entities/recomm-letter.entity';
import { RecommLetterStatus } from '../../value-objects/recomm-letter-status.vo';
import type { RecommLetter, NewRecommLetter } from '@infrastructure/database/schema';

/**
 * Recommendation Letter Mapper
 * 
 * Maps between persistence model and domain entity
 */
export class RecommLetterMapper {
  // DB record -> Domain Entity
  static toDomain(record: RecommLetter): RecommLetterEntity {
    return RecommLetterEntity.create({
      id: record.id,
      studentUserId: record.studentUserId,
      letterTypeId: record.letterTypeId,
      packageTypeId: record.packageTypeId ?? undefined,
      serviceType: record.serviceType,
      fileName: record.fileName,
      fileUrl: record.fileUrl,
      status: record.status as RecommLetterStatus,
      uploadedBy: record.uploadedBy,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      description: record.description ?? undefined,
      mentorUserId: record.mentorUserId ?? undefined,
      billedAt: record.billedAt ? new Date(record.billedAt) : undefined,
    });
  }

  // Domain Entity -> DB record (for insert)
  static toPersistence(entity: RecommLetterEntity): Omit<NewRecommLetter, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      studentUserId: entity.getStudentUserId(),
      letterTypeId: entity.getLetterTypeId(),
      packageTypeId: entity.getPackageTypeId() ?? null,
      serviceType: entity.getServiceType(),
      fileName: entity.getFileName(),
      fileUrl: entity.getFileUrl(),
      status: entity.getStatus(),
      uploadedBy: entity.getUploadedBy(),
      description: entity.getDescription() ?? null,
      mentorUserId: entity.getMentorUserId() ?? null,
      billedAt: entity.getBilledAt() ?? null,
    };
  }

  // Domain Entity -> DB record (for update)
  static toPersistenceForUpdate(entity: RecommLetterEntity): Partial<RecommLetter> {
    return {
      id: entity.getId(),
      studentUserId: entity.getStudentUserId(),
      letterTypeId: entity.getLetterTypeId(),
      packageTypeId: entity.getPackageTypeId() ?? null,
      serviceType: entity.getServiceType(),
      fileName: entity.getFileName(),
      fileUrl: entity.getFileUrl(),
      status: entity.getStatus(),
      uploadedBy: entity.getUploadedBy(),
      description: entity.getDescription() ?? null,
      mentorUserId: entity.getMentorUserId() ?? null,
      billedAt: entity.getBilledAt() ?? null,
      updatedAt: entity.getUpdatedAt(),
    };
  }
}

