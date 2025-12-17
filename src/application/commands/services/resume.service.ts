import { Inject, Injectable, Logger } from '@nestjs/common';
import { ResumeService as DomainResumeService } from '@domains/services/resume/services/resume.service';
import { ServiceHoldService } from '@domains/contract/services/service-hold.service';
import { BillResumeDto, CancelBillResumeDto } from '@domains/services/resume/dto/bill-resume.dto';
import { ResumeDetail } from '@domains/services/resume/entities/resume.entity';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { BadRequestException, NotFoundException } from '@nestjs/common';

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
    private readonly domainResumeService: DomainResumeService,
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
   * @param dto Billing DTO (includes studentId from frontend)
   * @param userId Counselor ID
   */
  async billResume(
    resumeId: string,
    dto: BillResumeDto,
    userId: string,
  ): Promise<ResumeDetail> {
    this.logger.log(`Billing resume: resumeId=${resumeId}, studentId=${dto.studentId}`);

    try {
      // Execute in transaction
      return await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Step 1: Create service hold (check and reserve balance)
        const hold = await this.serviceHoldService.createHold(
          {
            studentId: dto.studentId,
            serviceType: dto.serviceType || 'Resume',
            quantity: 1,
            createdBy: userId,
          },
          tx,
        );

        this.logger.debug(`Service hold created: ${hold.id}`);

        // Step 2: Call domain layer billing logic
        const result = await this.domainResumeService.billResume(
          resumeId,
          dto,
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
   * @param dto Cancel billing DTO
   * @param userId Counselor ID
   */
  async cancelBillResume(
    resumeId: string,
    dto: CancelBillResumeDto,
    userId: string,
  ): Promise<ResumeDetail> {
    this.logger.log(`Canceling resume billing: resumeId=${resumeId}`);

    try {
      // Get resume to find related hold
      const resume = await this.domainResumeService.findById(resumeId);
      if (!resume) {
        throw new NotFoundException('RESUME_NOT_FOUND');
      }

      if (!resume.mentorUserId) {
        throw new BadRequestException('RESUME_NOT_BILLED');
      }

      // Execute in transaction
      return await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Step 1: Cancel billing in domain layer
        const result = await this.domainResumeService.cancelBillResume(
          resumeId,
          dto,
          userId,
          tx,
        );

        // Step 2: Find and release related hold (use resumeId as related booking ID)
        // Note: Assumes hold was linked to resume via updateRelatedBooking
        const activeHolds = await this.serviceHoldService.getActiveHolds(
          resume.studentUserId,
          dto.serviceType || 'resume_revision',
        );

        // Find hold with matching related booking ID
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

