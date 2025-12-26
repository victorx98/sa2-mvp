import { Inject, Injectable, Logger } from '@nestjs/common';
import { ResumeDomainService } from '@domains/services/resume/services/resume-domain.service';
import { ServiceHoldService } from '@domains/contract/services/service-hold.service';
import { GetUserUseCase } from '@application/queries/identity/use-cases/get-user.use-case';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ResumeEntity } from '@domains/services/resume/entities/resume.entity';

@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainResumeService: ResumeDomainService,
    private readonly serviceHoldService: ServiceHoldService,
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  async listResumesWithDetails(studentUserId: string) {
    const grouped = await this.domainResumeService.listByStudent(studentUserId);
    
    const allResumes = Object.values(grouped).flat();
    const userIds = [...new Set([
      ...allResumes.map(r => r.getMentorUserId()).filter(Boolean),
      ...allResumes.map(r => r.getUploadedBy()).filter(Boolean),
      ...allResumes.map(r => r.getBilledBy()).filter(Boolean),
    ])] as string[];
    
    const users = userIds.length > 0 
      ? await this.getUserUseCase.getUsersByIds(userIds)
      : [];
    const userMap = new Map(users.map(u => [u.id, u]));
    
    const enrichedGrouped: Record<string, any[]> = {};
    
    for (const [jobTitle, resumes] of Object.entries(grouped)) {
      enrichedGrouped[jobTitle] = resumes.map(resume => {
        const mentor = resume.getMentorUserId() 
          ? userMap.get(resume.getMentorUserId()) 
          : null;
        
        const mentorName = mentor ? {
          en: mentor.nameEn || mentor.email,
          zh: mentor.nameZh || mentor.nameEn || mentor.email,
        } : null;

        const uploadedByUser = resume.getUploadedBy()
          ? userMap.get(resume.getUploadedBy())
          : null;

        const uploadedName = uploadedByUser ? {
          en: uploadedByUser.nameEn || uploadedByUser.email,
          zh: uploadedByUser.nameZh || uploadedByUser.nameEn || uploadedByUser.email,
        } : null;

        const billedByUser = resume.getBilledBy()
          ? userMap.get(resume.getBilledBy())
          : null;

        const billedName = billedByUser ? {
          en: billedByUser.nameEn || billedByUser.email,
          zh: billedByUser.nameZh || billedByUser.nameEn || billedByUser.email,
        } : null;

        return {
          id: resume.getId(),
          studentUserId: resume.getStudentUserId(),
          jobTitle: resume.getJobTitle(),
          sessionType: resume.getSessionType(),
          fileName: resume.getFileName(),
          fileUrl: resume.getFileUrl(),
          status: resume.getStatus(),
          uploadedBy: resume.getUploadedBy(),
          uploadedName,
          createdAt: resume.getCreatedAt(),
          updatedAt: resume.getUpdatedAt(),
          description: resume.getDescription(),
          finalSetAt: resume.getFinalSetAt(),
          mentorUserId: resume.getMentorUserId(),
          mentorName,
          billedBy: resume.getBilledBy(),
          billedName,
          billedAt: resume.getBilledAt(),
        };
      });
    }

    return enrichedGrouped;
  }

  async billResume(
    resumeId: string,
    params: {
      mentorId: string;
      description?: string;
      studentId: string;
      serviceType?: string;
    },
    userId: string,
  ): Promise<ResumeEntity> {
    this.logger.log(`Billing resume: resumeId=${resumeId}, studentId=${params.studentId}`);

    try {
      return await this.db.transaction(async (tx: DrizzleTransaction) => {
        const hold = await this.serviceHoldService.createHold(
          {
            studentId: params.studentId,
            serviceType: params.serviceType || 'Resume',
            quantity: 1,
            createdBy: userId,
          },
          tx,
        );

        this.logger.debug(`Service hold created: ${hold.id}`);

        const result = await this.domainResumeService.billResume(
          resumeId,
          {
            mentorId: params.mentorId,
            description: params.description,
          },
          userId,
          tx,
        );

        return result;
      });
    } catch (error) {
      this.logger.error(`Failed to bill resume: ${error.message}`, error.stack);
      throw error;
    }
  }

  async cancelBillResume(
    resumeId: string,
    params: {
      description?: string;
      serviceType?: string;
    },
    userId: string,
  ): Promise<ResumeEntity> {
    this.logger.log(`Canceling resume billing: resumeId=${resumeId}`);

    try {
      const resume = await this.domainResumeService.findById(resumeId);
      if (!resume) {
        throw new NotFoundException('RESUME_NOT_FOUND');
      }

      if (!resume.getMentorUserId()) {
        throw new BadRequestException('RESUME_NOT_BILLED');
      }

      return await this.db.transaction(async (tx: DrizzleTransaction) => {
        const result = await this.domainResumeService.cancelBillResume(
          resumeId,
          {
            description: params.description,
          },
          userId,
          tx,
        );

        const activeHolds = await this.serviceHoldService.getActiveHolds(
          resume.getStudentUserId(),
          params.serviceType || 'resume_revision',
        );

        const relatedHold = activeHolds.find(
          (h) => h.relatedBookingId === resumeId,
        );

        if (relatedHold) {
          await this.serviceHoldService.releaseHold(
            relatedHold.id,
            'Billing cancelled',
            tx,
          );
          this.logger.debug(`Service hold released: ${relatedHold.id}`);
        } else {
          this.logger.warn(
            `No active hold found for resume ${resumeId}, skipping hold release`,
          );
        }

        return result;
      });
    } catch (error) {
      this.logger.error(
        `Failed to cancel resume billing: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
