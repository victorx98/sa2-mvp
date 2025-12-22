/**
 * Job Application Mapper (投递申请映射器)
 * Converts between domain entities and database records (在领域实体和数据库记录之间转换)
 */

import { JobApplication } from '../../entities/job-application.entity';
import {
  ApplicationStatus,
} from '../../value-objects/application-status.vo';
import { ApplicationTypeVO } from '../../value-objects/application-type.vo';
import { jobApplications } from '@infrastructure/database/schema/placement.schema';

/**
 * Database record type for job_applications table (job_applications表的数据库记录类型)
 */
type JobApplicationRecordType = typeof jobApplications.$inferSelect;

/**
 * Insert type for job_applications table (job_applications表的插入类型)
 */
type InsertJobApplicationType = typeof jobApplications.$inferInsert;

export class JobApplicationMapper {
  /**
   * Convert database record to domain entity (将数据库记录转换为领域实体)
   *
   * @param record - Job application database record (投递申请数据库记录)
   * @returns JobApplication domain entity (投递申请领域实体)
   */
  toDomain(record: JobApplicationRecordType): JobApplication {
    // Create value objects (创建值对象)
    const status = ApplicationStatus.reconstruct(record.status);
    const applicationType = ApplicationTypeVO.reconstruct(record.applicationType);

    // Reconstruct the JobApplication entity (重建JobApplication实体)
    return JobApplication.reconstruct({
      id: record.id,
      studentId: record.studentId,
      jobId: record.jobId,
      applicationType,
      coverLetter: record.coverLetter ?? undefined,
      status,
      assignedMentorId: record.assignedMentorId ?? undefined,
      recommendedBy: record.recommendedBy ?? undefined,
      recommendedAt: record.recommendedAt ?? undefined,
      submittedAt: record.submittedAt,
      updatedAt: record.updatedAt,
      notes: record.notes ?? undefined,
      jobLink: record.jobLink ?? undefined, // Job link for quick access [岗位链接便于快速访问]
    });
  }

  /**
   * Convert domain entity to database record (将领域实体转换为数据库记录)
   *
   * @param application - JobApplication domain entity (投递申请领域实体)
   * @returns Database record object (数据库记录对象)
   */
  toPersistence(application: JobApplication): InsertJobApplicationType {
    // Convert domain entity to record (将领域实体转换为记录)
    const record: InsertJobApplicationType = {
      id: application.getId(),
      studentId: application.getStudentId(),
      jobId: application.getJobId(),
      applicationType: application.getApplicationType().getValue() as any,
      coverLetter: application.getCoverLetter() ?? null,
      status: application.getStatus().getValue() as any,
      assignedMentorId: application.getAssignedMentorId() ?? null,
      recommendedBy: application.getRecommendedBy() ?? null,
      recommendedAt: application.getRecommendedAt() ?? null,
      submittedAt: application.getSubmittedAt(),
      updatedAt: application.getUpdatedAt(),
      notes: application.getNotes() ?? null,
      jobLink: application.getJobLink() ?? null, // Job link for quick access [岗位链接便于快速访问]
    };

    return record;
  }
}
