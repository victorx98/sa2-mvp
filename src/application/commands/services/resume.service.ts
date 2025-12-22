import { Inject, Injectable, Logger } from '@nestjs/common';
import { ResumeDomainService } from '@domains/services/resume/services/resume-domain.service';
import { ServiceHoldService } from '@domains/contract/services/service-hold.service';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ResumeEntity } from '@domains/services/resume/entities/resume.entity';

/**
 * Application Layer - Resume Service
 *
 * Orchestrates resume billing operations with service hold management
 * Coordinates between Domain Services (Resume, ServiceHold)
 */
@Injectable()
export class ResumeService {
  private readonly logger = new Logger(ResumeService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainResumeService: ResumeDomainService,
    private readonly serviceHoldService: ServiceHoldService,
  ) {}

  /**
   * Bill resume with service hold validation
   * 
   * Flow:
   * 1. Create service hold (check balance)
   * 2. Call domain layer billing logic
   * 
   * @param resumeId Resume ID
   * @param params Billing params (mentorId, description, studentId, serviceType)
   * @param userId Counselor ID
   */
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
      // Execute in transaction
      return await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Step 1: Create service hold (check and reserve balance)
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

        // Step 2: Call domain layer billing logic
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

  /**
   * Cancel resume billing with service hold release
   * 
   * Flow:
   * 1. Cancel billing in domain layer
   * 2. Release service hold
   * 
   * @param resumeId Resume ID
   * @param params Cancel params (description, serviceType)
   * @param userId Counselor ID
   */
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
      // Get resume to find related hold
      const resume = await this.domainResumeService.findById(resumeId);
      if (!resume) {
        throw new NotFoundException('RESUME_NOT_FOUND');
      }

      if (!resume.getMentorUserId()) {
        throw new BadRequestException('RESUME_NOT_BILLED');
      }

      // Execute in transaction
      return await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Step 1: Cancel billing in domain layer
        const result = await this.domainResumeService.cancelBillResume(
          resumeId,
          {
            description: params.description,
          },
          userId,
          tx,
        );

        // Step 2: Find and release related hold
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

