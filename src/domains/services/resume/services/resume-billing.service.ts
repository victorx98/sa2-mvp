import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { ResumeRepository } from '../repositories/resume.repository';
import { ResumeMapper } from '../mappers/resume.mapper';
import { BillResumeDto } from '../dto/bill-resume.dto';
import { ResumeDetail } from '../entities/resume.entity';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase } from '@shared/types/database.types';
import { resumes, serviceReferences } from '@infrastructure/database/schema';
import { RESUME_BILLED_EVENT } from '@shared/events/event-constants';

@Injectable()
export class ResumeBillingService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly resumeRepository: ResumeRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Bill resume
   * - Each job title can only be billed once
   * - Creates service reference and publishes event
   */
  async billResume(dto: BillResumeDto, userId: string): Promise<ResumeDetail> {
    const resume = await this.resumeRepository.findById(dto.resumeId);
    if (!resume) {
      throw new NotFoundException('RESUME_NOT_FOUND');
    }

    // Check if already billed
    if (resume.mentorUserId) {
      throw new BadRequestException('RESUME_ALREADY_BILLED');
    }

    // Check if job title already billed
    const billedResume = await this.resumeRepository.findBilledByJobTitle(
      resume.studentUserId,
      resume.jobTitle,
    );
    if (billedResume) {
      throw new BadRequestException('JOB_TITLE_ALREADY_BILLED');
    }

    // Execute in transaction
    const result = await this.db.transaction(async (tx) => {
      // Update resume billing info
      const [updated] = await tx
        .update(resumes)
        .set({
          mentorUserId: dto.mentorUserId,
          billedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(resumes.id, dto.resumeId))
        .returning();

      // Create service reference
      await tx.insert(serviceReferences).values({
        id: resume.id,
        serviceType: resume.sessionType,
        title: `${resume.jobTitle} Resume Review`,
        studentUserId: resume.studentUserId,
        providerUserId: dto.mentorUserId,
        consumedUnits: '1.00',
        unitType: 'count',
        completedTime: new Date(),
      });

      return updated;
    });

    // Publish event
    this.eventEmitter.emit(RESUME_BILLED_EVENT, {
      resumeId: resume.id,
      studentUserId: resume.studentUserId,
      mentorUserId: dto.mentorUserId,
      jobTitle: resume.jobTitle,
      billedAt: result.billedAt,
    });

    return ResumeMapper.toDetail(result);
  }
}

