/**
 * Job Position Mapper (岗位映射器)
 * Converts between domain entities and database records (在领域实体和数据库记录之间转换)
 */

import { JobPosition, JobLocation } from '../../entities/job-position.entity';
import {
  JobStatusVO,
  H1BStatusVO,
  USCitizenshipRequirementVO,
  JobLevelVO,
  JobTypeVO,
} from '../../value-objects';
import { recommendedJobs } from '@infrastructure/database/schema/placement.schema';

/**
 * Database record type for recommended_jobs table (recommended_jobs表的数据库记录类型)
 */
type JobPositionRecordType = typeof recommendedJobs.$inferSelect;

/**
 * Insert type for recommended_jobs table (recommended_jobs表的插入类型)
 */
type InsertJobPositionType = typeof recommendedJobs.$inferInsert;

export class JobPositionMapper {
  /**
   * Convert database record to domain entity (将数据库记录转换为领域实体)
   *
   * @param record - Job position database record (岗位数据库记录)
   * @returns JobPosition domain entity (岗位领域实体)
   */
  toDomain(record: JobPositionRecordType): JobPosition {
    // Create value objects (创建值对象)
    const status = JobStatusVO.reconstruct(record.status);
    const h1bStatus = record.h1b ? H1BStatusVO.reconstruct(record.h1b) : undefined;
    const usCitizenshipRequirement = record.usCitizenship
      ? USCitizenshipRequirementVO.reconstruct(record.usCitizenship)
      : undefined;
    const jobLevel = record.level ? JobLevelVO.reconstruct(record.level) : undefined;

    // Reconstruct the JobPosition entity (重建JobPosition实体)
    return JobPosition.reconstruct({
      id: record.id,
      jobId: record.jobId ?? undefined,
      jobLink: record.jobLink ?? undefined,
      objectId: record.objectId ?? undefined,
      normalizedJobTitles: record.normalizedJobTitles ?? [],
      jobTypes: record.jobTypes ?? [],
      postDate: record.postDate ?? new Date(),
      applicationDeadline: record.applicationDeadline ?? undefined,
      status,
      title: record.title,
      countryCode: record.countryCode ?? undefined,
      experienceRequirement: record.experienceRequirement ?? undefined,
      salaryDetails: record.salaryDetails ?? undefined,
      jobLocations: (record.jobLocations ?? []) as JobLocation[],
      jobDescription: record.jobDescription ?? undefined,
      companyName: record.companyName,
      h1bStatus,
      usCitizenshipRequirement,
      jobLevel,
      aiAnalysis: record.aiAnalysis ?? undefined,
      jobApplicationTypes: record.jobApplicationType ?? ['direct'],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  /**
   * Convert domain entity to database record (将领域实体转换为数据库记录)
   *
   * @param jobPosition - JobPosition domain entity (岗位领域实体)
   * @returns Database record object (数据库记录对象)
   */
  toPersistence(jobPosition: JobPosition): InsertJobPositionType {
    // Convert domain entity to record (将领域实体转换为记录)
    const record: InsertJobPositionType = {
      id: jobPosition.getId(),
      jobId: jobPosition.getJobId() ?? null,
      jobLink: jobPosition.getJobLink() ?? null,
      objectId: jobPosition.getObjectId() ?? null,
      normalizedJobTitles: jobPosition.getNormalizedJobTitles(),
      jobTypes: jobPosition.getJobTypes(),
      postDate: jobPosition.getPostDate(),
      applicationDeadline: jobPosition.getApplicationDeadline() ?? null,
      status: jobPosition.getStatus().getValue(),
      title: jobPosition.getTitle(),
      countryCode: jobPosition.getCountryCode() ?? null,
      experienceRequirement: jobPosition.getExperienceRequirement() ?? null,
      salaryDetails: jobPosition.getSalaryDetails() ?? null,
      jobLocations: jobPosition.getJobLocations(),
      jobDescription: jobPosition.getJobDescription() ?? null,
      companyName: jobPosition.getCompanyName(),
      h1b: jobPosition.getH1BStatus()?.getValue() ?? null,
      usCitizenship: jobPosition.getUSCitizenshipRequirement()?.getValue() ?? null,
      level: jobPosition.getJobLevel()?.getValue() ?? null,
      aiAnalysis: jobPosition.getAIAnalysis() ?? null,
      jobApplicationType: jobPosition.getJobApplicationTypes(),
    };

    return record;
  }
}
