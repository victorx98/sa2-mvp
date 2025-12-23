import { Inject, Injectable, Logger, BadRequestException } from "@nestjs/common";
import { CommandBase } from "@application/core/command.base";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import type { DrizzleDatabase } from "@shared/types/database.types";
import { jobApplications, applicationHistory, recommendedJobs } from "@infrastructure/database/schema";
import { eq, and, inArray } from "drizzle-orm";
import { ApplicationType, ApplicationStatus } from "@domains/placement/types";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JOB_APPLICATION_STATUS_CHANGED_EVENT } from "@shared/events/event-constants";

/**
 * Interface for recommending referral applications in batch [批量内推推荐的接口]
 */
interface IRecommendReferralApplicationsBatchDto {
  studentIds: string[];
  jobIds: string[];
  recommendedBy: string;
}


/**
 * Recommend Referral Applications Batch Command [批量内推推荐命令]
 * - All-or-nothing transaction semantics [全成功事务语义]
 * - Validates jobs exist and are active [验证岗位存在且为active]
 * - Prevents duplicate applications [防止重复申请]
 * - Creates applications and history records in transaction [在事务中创建申请和历史记录]
 * - Publishes domain events after successful transaction [事务成功后发布领域事件]
 */
@Injectable()
export class RecommendReferralApplicationsBatchCommand extends CommandBase {

  constructor(
    @Inject(DATABASE_CONNECTION) db: DrizzleDatabase,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super(db);
  }

  /**
   * Execute command [执行命令]
   * - Batch creates referral applications with validation [批量创建内推申请并进行验证]
   * - All-or-nothing transaction: any failure rolls back all inserts [全成功事务：任一失败则整体回滚]
   */
  async execute(input: { dto: IRecommendReferralApplicationsBatchDto }) {
    const dto = input.dto;

    if (!dto) {
      throw new BadRequestException(
        "recommendReferralApplicationsBatch dto is required",
      );
    }

    const studentIds = Array.from(new Set(dto.studentIds ?? []));
    const jobIds = Array.from(new Set(dto.jobIds ?? []));

    if (!dto.recommendedBy) {
      throw new BadRequestException("recommendedBy is required");
    }
    if (studentIds.length === 0) {
      throw new BadRequestException("studentIds must not be empty");
    }
    if (jobIds.length === 0) {
      throw new BadRequestException("jobIds must not be empty");
    }

    const pairs = studentIds.flatMap((studentId) =>
      jobIds.map((jobId) => ({ studentId, jobId })),
    );

    // Keep a reasonable cap to prevent accidental explosion (N*M) [限制组合数量避免误操作]
    if (pairs.length > 5000) {
      throw new BadRequestException(
        `Too many combinations (${pairs.length}). Please reduce studentIds/jobIds.`,
      );
    }

    this.logger.log(
      `Batch recommending referral applications: ${pairs.length} combinations`,
    );

    // Validate jobs exist and are active [校验岗位存在且为active]
    const jobs = await this.db
      .select({
        id: recommendedJobs.id,
        status: recommendedJobs.status,
        title: recommendedJobs.title,
        jobLink: recommendedJobs.jobLink,
        companyName: recommendedJobs.companyName,
        jobLocations: recommendedJobs.jobLocations,
        jobTypes: recommendedJobs.jobTypes,
        normalizedJobTitles: recommendedJobs.normalizedJobTitles,
        level: recommendedJobs.level,
        jobId: recommendedJobs.jobId,
      })
      .from(recommendedJobs)
      .where(and(inArray(recommendedJobs.id, jobIds), eq(recommendedJobs.status, "active")));

    const foundJobIdSet = new Set(jobs.map((j) => j.id));
    const missingJobIds = jobIds.filter((id) => !foundJobIdSet.has(id));
    if (missingJobIds.length > 0) {
      throw new BadRequestException(
        `Some jobs are missing or not active: ${missingJobIds.slice(0, 10).join(", ")}`,
      );
    }

    // Create job info map for fast lookup [创建职位信息映射表用于快速查找]
    const jobInfoMap = new Map(jobs.map((job) => [job.id, job]));

    // Detect duplicates (any existing studentId+recommendedJobId is forbidden) [检测重复申请（任一已存在则整体失败）]
    const existing = await this.db
      .select({ studentId: jobApplications.studentId, recommendedJobId: jobApplications.recommendedJobId })
      .from(jobApplications)
      .where(and(inArray(jobApplications.studentId, studentIds), inArray(jobApplications.recommendedJobId, jobIds)));

    const existingPairSet = new Set(existing.map((x) => `${x.studentId}::${x.recommendedJobId}`));
    const duplicatePairs = pairs.filter((p) => existingPairSet.has(`${p.studentId}::${p.jobId}`));
    if (duplicatePairs.length > 0) {
      const sample = duplicatePairs
        .slice(0, 10)
        .map((p) => `${p.studentId}/${p.jobId}`)
        .join(", ");
      throw new BadRequestException(`Duplicate applications detected: ${sample}`);
    }

    const recommendedAt = new Date();

    // Create applications in transaction [在事务中创建申请]
    const createdApplications = await this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(jobApplications)
        .values(
          pairs.map((p) => {
            const job = jobInfoMap.get(p.jobId);
            if (!job) {
              throw new Error(`Job ${p.jobId} not found in jobInfoMap`);
            }
            // Extract location from jobLocations JSONB array [从jobLocations JSONB数组中提取location]
            let location: string | undefined = undefined;
            if (job.jobLocations && Array.isArray(job.jobLocations) && job.jobLocations.length > 0) {
              const firstLocation = job.jobLocations[0];
              if (typeof firstLocation === 'object' && firstLocation !== null) {
                const parts: string[] = [];
                if (firstLocation.city) parts.push(firstLocation.city);
                if (firstLocation.state) parts.push(firstLocation.state);
                if (firstLocation.country) parts.push(firstLocation.country);
                location = parts.length > 0 ? parts.join(', ') : undefined;
              } else if (typeof firstLocation === 'string') {
                location = firstLocation;
              }
            }

            return {
              studentId: p.studentId,
              recommendedJobId: p.jobId, // Use recommendedJobId field (UUID reference to recommended_jobs) [使用recommendedJobId字段（UUID引用recommended_jobs）]
              jobId: job.jobId || null, // External job ID [外部岗位ID]
              jobLink: job.jobLink || null, // Store job link for quick access [存储岗位链接便于快速访问]
              applicationType: ApplicationType.REFERRAL,
              status: "recommended" as const,
              recommendedBy: dto.recommendedBy, // Set recommended_by field [设置推荐人字段]
              recommendedAt: recommendedAt, // Set recommended_at field [设置推荐时间字段]
              // Redundant fields from recommended_jobs for query convenience [从recommended_jobs冗余字段，便于查询]
              jobType: job.jobTypes && job.jobTypes.length > 0 ? job.jobTypes[0] : undefined, // Take first job type [取第一个职位类型]
              jobTitle: job.title || undefined, // Job title [职位标题]
              companyName: job.companyName || undefined, // Company name [公司名称]
              location: location, // Location extracted from jobLocations [从jobLocations提取的工作地点]
              jobCategories: undefined, // Not available in recommended_jobs [recommended_jobs中不可用]
              normalJobTitle: job.normalizedJobTitles && job.normalizedJobTitles.length > 0 ? job.normalizedJobTitles[0] : undefined, // Take first normalized job title [取第一个标准化职位标题]
              level: job.level || undefined, // Job level [职位级别]
            };
          }),
        )
        .returning();

      // Create history records for all applications [为所有申请创建历史记录]
      await tx.insert(applicationHistory).values(
        inserted.map((app) => ({
          applicationId: app.id,
          previousStatus: null,
          newStatus: app.status as ApplicationStatus,
          changedBy: dto.recommendedBy,
          changeReason: "Counselor recommendation",
          changeMetadata: {
            recommendedBy: dto.recommendedBy,
            recommendedAt: recommendedAt.toISOString(),
          },
        })),
      );

      return inserted;
    });

    this.logger.log(
      `Batch referral recommendation completed: ${createdApplications.length} applications created`,
    );

    // Publish events after transaction (在事务后发布事件) [在事务成功后发布事件]
    // Events are published after transaction commits to ensure data consistency [事件在事务提交后发布以确保数据一致性]
    const events = createdApplications.map((application) => {
      const payload = {
        applicationId: application.id,
        previousStatus: null,
        newStatus: application.status,
        changedBy: dto.recommendedBy,
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


