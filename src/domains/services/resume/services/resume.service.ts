import { Inject, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { ResumeRepository } from '../repositories/resume.repository';
import { ResumeMapper } from '../mappers/resume.mapper';
import { UploadResumeDto } from '../dto/upload-resume.dto';
import { BillResumeDto, CancelBillResumeDto } from '../dto/bill-resume.dto';
import { ResumeDetail } from '../entities/resume.entity';
import { ServiceRegistryService } from '@domains/services/service-registry/services/service-registry.service';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { resumes, serviceReferences } from '@infrastructure/database/schema';
import { RESUME_BILLED_EVENT, RESUME_BILL_CANCELLED_EVENT } from '@shared/events/event-constants';

/**
 * Domain Layer - Resume Service
 * 
 * Handles resume business logic and lifecycle
 */
@Injectable()
export class ResumeService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly resumeRepository: ResumeRepository,
    private readonly serviceRegistryService: ServiceRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Upload resume
   */
  async upload(dto: UploadResumeDto, userId: string): Promise<ResumeDetail> {
    // Validate S3 URL format
    if (!dto.fileUrl.startsWith('https://') && !dto.fileUrl.startsWith('s3://')) {
      throw new BadRequestException('INVALID_FILE_URL');
    }

    // Create resume
    const resume = await this.resumeRepository.create({
      studentUserId: dto.studentUserId,
      jobTitle: dto.jobTitle,
      sessionType: dto.sessionType || 'Resume',
      fileName: dto.fileName,
      fileUrl: dto.fileUrl,
      status: 'uploaded',
      uploadedBy: userId,
    });

    return ResumeMapper.toDetail(resume);
  }

  /**
   * List resumes by student (grouped by job title)
   */
  async listByStudent(studentUserId: string): Promise<Record<string, ResumeDetail[]>> {
    const resumes = await this.resumeRepository.findAllByStudent(studentUserId);
    const details = ResumeMapper.toDetails(resumes);

    // Group by job title
    const grouped: Record<string, ResumeDetail[]> = {};
    for (const detail of details) {
      if (!grouped[detail.jobTitle]) {
        grouped[detail.jobTitle] = [];
      }
      grouped[detail.jobTitle].push(detail);
    }

    return grouped;
  }

  /**
   * Set resume as final
   * - Auto-cancel previous final for same job title
   */
  async setFinal(resumeId: string, userId: string, description?: string): Promise<ResumeDetail> {
    const resume = await this.resumeRepository.findById(resumeId);
    if (!resume) {
      throw new NotFoundException('RESUME_NOT_FOUND');
    }

    if (resume.status !== 'uploaded') {
      throw new BadRequestException('INVALID_STATUS');
    }

    // Check for existing final resume for same job title
    const existingFinal = await this.resumeRepository.findFinalByJobTitle(
      resume.studentUserId,
      resume.jobTitle,
    );

    // Cancel existing final if exists
    if (existingFinal) {
      await this.resumeRepository.update(existingFinal.id, {
        status: 'uploaded',
        finalSetAt: null,
      });
    }

    // Set new final
    const updated = await this.resumeRepository.update(resumeId, {
      status: 'final',
      finalSetAt: new Date(),
      description: description,
    });

    return ResumeMapper.toDetail(updated);
  }

  /**
   * Cancel final status
   */
  async cancelFinal(resumeId: string, userId: string, description?: string): Promise<ResumeDetail> {
    const resume = await this.resumeRepository.findById(resumeId);
    if (!resume) {
      throw new NotFoundException('RESUME_NOT_FOUND');
    }

    if (resume.status !== 'final') {
      throw new BadRequestException('RESUME_NOT_FINAL');
    }

    const updated = await this.resumeRepository.update(resumeId, {
      status: 'uploaded',
      finalSetAt: null,
      description: description,
    });

    return ResumeMapper.toDetail(updated);
  }

  /**
   * Delete resume (soft delete)
   * - Cannot delete billed or final resumes
   */
  async delete(resumeId: string, userId: string): Promise<void> {
    const resume = await this.resumeRepository.findById(resumeId);
    if (!resume) {
      throw new NotFoundException('RESUME_NOT_FOUND');
    }

    // Check if billed
    if (resume.mentorUserId) {
      throw new BadRequestException('BILLED_RESUME_CANNOT_DELETE');
    }

    // Check if final
    if (resume.status === 'final') {
      throw new BadRequestException('FINAL_RESUME_CANNOT_DELETE');
    }

    await this.resumeRepository.softDelete(resumeId);
  }

  /**
   * Find resume by ID
   */
  async findById(resumeId: string) {
    return this.resumeRepository.findById(resumeId);
  }

  /**
   * Bill resume (Domain layer - core business logic)
   * 
   * Validates business rules, updates resume status, registers service reference
   * Publishes billing event after transaction
   * 
   * @param resumeId Resume ID
   * @param dto Billing DTO
   * @param userId Counselor ID
   * @param tx Transaction context
   */
  async billResume(
    resumeId: string,
    dto: BillResumeDto,
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<ResumeDetail> {
    const executor = tx ?? this.db;
    const resume = await this.resumeRepository.findById(resumeId);
    if (!resume) {
      throw new NotFoundException('RESUME_NOT_FOUND');
    }

    // Validate business rules
    if (resume.mentorUserId) {
      throw new BadRequestException('RESUME_ALREADY_BILLED');
    }

    const billedResume = await this.resumeRepository.findBilledByJobTitle(
      resume.studentUserId,
      resume.jobTitle,
    );
    if (billedResume) {
      throw new BadRequestException('JOB_TITLE_ALREADY_BILLED');
    }

    // Execute billing operations in transaction
    const result = await (async () => {
      // Update resume billing info
      const [updated] = await executor
        .update(resumes)
        .set({
          mentorUserId: dto.mentorId,
          billedAt: new Date(),
          description: dto.description,
          updatedAt: new Date(),
        })
        .where(eq(resumes.id, resumeId))
        .returning();

      // Register service reference (pass tx if in transaction context)
      await this.serviceRegistryService.registerService({
        id: resume.id,
        service_type: resume.sessionType,
        title: `${resume.jobTitle} Resume Review`,
        student_user_id: resume.studentUserId,
        provider_user_id: dto.mentorId,
        consumed_units: 1.0,
        unit_type: 'count',
        completed_time: new Date(),
      }, tx);

      return updated;
    })();

    // Publish event (outside transaction if no tx provided)
    if (!tx) {
      this.eventEmitter.emit(RESUME_BILLED_EVENT, {
        resumeId: resume.id,
        studentId: resume.studentUserId,
        mentorId: dto.mentorId,
        jobTitle: resume.jobTitle,
        description: dto.description,
        billedAt: result.billedAt,
      });
    }

    return ResumeMapper.toDetail(result);
  }

  /**
   * Cancel resume billing (Domain layer - core business logic)
   * 
   * Clears billing info and deletes service reference
   * Publishes cancellation event after transaction
   * 
   * @param resumeId Resume ID
   * @param dto Cancel billing DTO
   * @param userId Counselor ID
   * @param tx Transaction context
   */
  async cancelBillResume(
    resumeId: string,
    dto: CancelBillResumeDto,
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<ResumeDetail> {
    const executor = tx ?? this.db;
    const resume = await this.resumeRepository.findById(resumeId);
    if (!resume) {
      throw new NotFoundException('RESUME_NOT_FOUND');
    }

    if (!resume.mentorUserId) {
      throw new BadRequestException('RESUME_NOT_BILLED');
    }

    const previousMentorId = resume.mentorUserId;

    // Execute cancellation operations in transaction
    const result = await (async () => {
      // Clear billing info
      const [updated] = await executor
        .update(resumes)
        .set({
          mentorUserId: null,
          billedAt: null,
          description: dto.description,
          updatedAt: new Date(),
        })
        .where(eq(resumes.id, resumeId))
        .returning();

      // Delete service reference
      await executor
        .delete(serviceReferences)
        .where(eq(serviceReferences.id, resumeId));

      return updated;
    })();

    // Publish event (outside transaction if no tx provided)
    if (!tx) {
      this.eventEmitter.emit(RESUME_BILL_CANCELLED_EVENT, {
        resumeId: resume.id,
        studentId: resume.studentUserId,
        mentorId: previousMentorId,
        jobTitle: resume.jobTitle,
        description: dto.description,
        cancelledAt: new Date(),
      });
    }

    return ResumeMapper.toDetail(result);
  }
}

