import { Inject, Injectable, Logger, BadRequestException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { jobApplications, applicationHistory } from "@infrastructure/database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { ApplicationType, ApplicationStatus } from "@domains/placement/types";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JOB_APPLICATION_STATUS_CHANGED_EVENT } from "@shared/events/event-constants";

interface IProxyJob {
  objectId: string;
  externalJobId: string;
  jobLink: string;
  jobType: string;
  jobTitle: string;
  companyName: string;
  location: string;
  jobCategories: string[];
  normalJobTitle: string;
  level: string;
}

interface ICreateProxyApplicationsBatchDto {
  studentIds: string[];
  jobs: IProxyJob[];
  createdBy: string;
}

@Injectable()
export class CreateProxyApplicationsBatchCommand extends CommandBase {
  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(db);
  }

  async execute(input: { dto: ICreateProxyApplicationsBatchDto }) {
    const dto = input.dto;

    if (!dto) {
      throw new BadRequestException("createProxyApplicationsBatch dto is required");
    }

    const studentIds = Array.from(new Set(dto.studentIds ?? []));
    const jobs = dto.jobs ?? [];

    if (!dto.createdBy) {
      throw new BadRequestException("createdBy is required");
    }
    if (studentIds.length === 0) {
      throw new BadRequestException("studentIds must not be empty");
    }
    if (jobs.length === 0) {
      throw new BadRequestException("jobs must not be empty");
    }

    // Validate field lengths
    for (const job of jobs) {
      if (job.objectId.length > 50) {
        throw new BadRequestException(`objectId exceeds maximum length of 50: ${job.objectId}`);
      }
      if (job.externalJobId.length > 255) {
        throw new BadRequestException(`externalJobId exceeds maximum length of 255: ${job.externalJobId}`);
      }
      if (job.jobLink.length > 255) {
        throw new BadRequestException(`jobLink exceeds maximum length of 255: ${job.jobLink}`);
      }
      if (job.jobType.length > 50) {
        throw new BadRequestException(`jobType exceeds maximum length of 50: ${job.jobType}`);
      }
      if (job.jobTitle.length > 300) {
        throw new BadRequestException(`jobTitle exceeds maximum length of 300: ${job.jobTitle}`);
      }
      if (job.companyName.length > 300) {
        throw new BadRequestException(`companyName exceeds maximum length of 300: ${job.companyName}`);
      }
      if (job.location.length > 255) {
        throw new BadRequestException(`location exceeds maximum length of 255: ${job.location}`);
      }
      if (job.normalJobTitle.length > 300) {
        throw new BadRequestException(`normalJobTitle exceeds maximum length of 300: ${job.normalJobTitle}`);
      }
      if (job.level.length > 20) {
        throw new BadRequestException(`level exceeds maximum length of 20: ${job.level}`);
      }
    }

    // Create pairs: studentId x job
    const pairs = studentIds.flatMap((studentId) =>
      jobs.map((job) => ({ studentId, job })),
    );

    if (pairs.length > 5000) {
      throw new BadRequestException(
        `Too many combinations (${pairs.length}). Please reduce studentIds/jobs.`,
      );
    }

    this.logger.log(
      `Batch creating proxy applications: ${pairs.length} combinations`,
    );

    // Check for duplicates based on studentId + objectId
    const objectIds = jobs.map((j) => j.objectId);
    const existing = await this.db
      .select({
        studentId: jobApplications.studentId,
        objectId: jobApplications.objectId,
      })
      .from(jobApplications)
      .where(
        and(
          inArray(jobApplications.studentId, studentIds),
          inArray(jobApplications.objectId, objectIds),
          eq(jobApplications.applicationType, ApplicationType.PROXY),
        ),
      );

    const existingPairSet = new Set(
      existing
        .filter((x) => x.objectId)
        .map((x) => `${x.studentId}::${x.objectId}`),
    );
    const duplicatePairs = pairs.filter(
      (p) => existingPairSet.has(`${p.studentId}::${p.job.objectId}`),
    );
    if (duplicatePairs.length > 0) {
      const sample = duplicatePairs
        .slice(0, 10)
        .map((p) => `${p.studentId}/${p.job.objectId}`)
        .join(", ");
      throw new BadRequestException(`Duplicate applications detected: ${sample}`);
    }

    const recommendedAt = new Date();

    const createdApplications = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(jobApplications)
        .values(
          pairs.map((p) => {
            const job = p.job;
            return {
              studentId: p.studentId,
              recommendedJobId: null, // Proxy flow does not link to recommended_jobs
              objectId: job.objectId,
              jobId: job.externalJobId,
              jobLink: job.jobLink,
              jobType: job.jobType,
              jobTitle: job.jobTitle,
              companyName: job.companyName,
              location: job.location,
              jobCategories: job.jobCategories,
              normalJobTitle: job.normalJobTitle,
              level: job.level,
              applicationType: ApplicationType.PROXY,
              status: "submitted" as const,
              recommendedBy: dto.createdBy,
              recommendedAt: recommendedAt,
            };
          }),
        )
        .returning();

      await tx.insert(applicationHistory).values(
        inserted.map((app) => ({
          applicationId: app.id,
          previousStatus: null,
          newStatus: app.status as ApplicationStatus,
          changedBy: dto.createdBy,
          changeReason: "Counselor proxy application",
          changeMetadata: {
            recommendedBy: dto.createdBy,
            recommendedAt: recommendedAt.toISOString(),
          },
        })),
      );

      return inserted;
    });

    this.logger.log(
      `Batch proxy application creation completed: ${createdApplications.length} applications created`,
    );

    const events = createdApplications.map((application) => {
      const payload = {
        applicationId: application.id,
        previousStatus: null,
        newStatus: application.status,
        changedBy: dto.createdBy,
        changedAt: application.submittedAt.toISOString(),
      };
      this.eventEmitter.emit(JOB_APPLICATION_STATUS_CHANGED_EVENT, payload);
      return { type: JOB_APPLICATION_STATUS_CHANGED_EVENT, payload };
    });

    return {
      data: { items: createdApplications },
      events,
    };
  }
}

