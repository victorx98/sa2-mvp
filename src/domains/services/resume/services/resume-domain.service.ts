import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { IResumeRepository, RESUME_REPOSITORY } from '../repositories/resume.repository.interface';
import { ResumeEntity } from '../entities/resume.entity';
import { ResumeStatus } from '../value-objects/resume-status.vo';
import { InvalidResumeUrlException, ResumeNotFoundException } from '../exceptions';
import { ServiceRegistryService } from '@domains/services/service-registry/services/service-registry.service';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { resumes, serviceReferences } from '@infrastructure/database/schema';
import { RESUME_BILLED_EVENT, RESUME_BILL_CANCELLED_EVENT } from '@shared/events/event-constants';
import { v4 as uuidv4 } from 'uuid';

/**
 * Domain Service - Resume Business Logic
 * 
 * Pure business logic for resume operations
 */
@Injectable()
export class ResumeDomainService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    @Inject(RESUME_REPOSITORY)
    private readonly resumeRepository: IResumeRepository,
    private readonly serviceRegistryService: ServiceRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Upload new resume
   */
  async upload(params: {
    studentUserId: string;
    jobTitle: string;
    sessionType?: string;
    fileName: string;
    fileUrl: string;
    uploadedBy: string;
  }): Promise<ResumeEntity> {
    // Validate URL format
    if (!params.fileUrl.startsWith('https://') && !params.fileUrl.startsWith('s3://')) {
      throw new InvalidResumeUrlException(params.fileUrl);
    }

    const entity = ResumeEntity.create({
      id: uuidv4(),
      studentUserId: params.studentUserId,
      jobTitle: params.jobTitle,
      sessionType: params.sessionType || 'Resume',
      fileName: params.fileName,
      fileUrl: params.fileUrl,
      status: ResumeStatus.UPLOADED,
      uploadedBy: params.uploadedBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.resumeRepository.create(entity);
  }

  /**
   * List resumes by student (grouped by job title)
   */
  async listByStudent(studentUserId: string): Promise<Record<string, ResumeEntity[]>> {
    const resumes = await this.resumeRepository.findAllByStudent(studentUserId);

    // Group by job title
    const grouped: Record<string, ResumeEntity[]> = {};
    for (const resume of resumes) {
      const jobTitle = resume.getJobTitle();
      if (!grouped[jobTitle]) {
        grouped[jobTitle] = [];
      }
      grouped[jobTitle].push(resume);
    }

    return grouped;
  }

  /**
   * Set resume as final version
   * Auto-cancel previous final for same job title
   */
  async setFinal(resumeId: string, userId: string, description?: string, tx?: DrizzleTransaction): Promise<ResumeEntity> {
    const executor = tx ?? this.db;
    const resume = await this.resumeRepository.findById(resumeId, tx);
    
    if (!resume) {
      throw new ResumeNotFoundException(resumeId);
    }

    // Use domain logic to mark as final
    resume.markAsFinal(userId);

    // Check for existing final resume for same job title
    const [existingFinal] = await executor
      .select()
      .from(resumes)
      .where(
        eq(resumes.studentUserId, resume.getStudentUserId()),
      )
      .limit(1);

    if (existingFinal && existingFinal.status === 'final' && existingFinal.id !== resumeId) {
      // Cancel existing final
      await executor
        .update(resumes)
        .set({
          status: 'uploaded',
          finalSetAt: null,
          updatedAt: new Date(),
        })
        .where(eq(resumes.id, existingFinal.id));
    }

    return this.resumeRepository.update(resume, tx);
  }

  /**
   * Cancel final status
   */
  async cancelFinal(resumeId: string, userId: string, description?: string, tx?: DrizzleTransaction): Promise<ResumeEntity> {
    const resume = await this.resumeRepository.findById(resumeId, tx);
    
    if (!resume) {
      throw new ResumeNotFoundException(resumeId);
    }

    if (resume.getStatus() !== ResumeStatus.FINAL) {
      throw new BadRequestException('RESUME_NOT_FINAL');
    }

    // Use domain logic
    resume.markAsDeleted();

    return this.resumeRepository.update(resume, tx);
  }

  /**
   * Delete resume (soft delete)
   */
  async delete(resumeId: string, userId: string, tx?: DrizzleTransaction): Promise<void> {
    const resume = await this.resumeRepository.findById(resumeId, tx);
    
    if (!resume) {
      throw new ResumeNotFoundException(resumeId);
    }

    // Check if billed
    if (resume.getMentorUserId()) {
      throw new BadRequestException('BILLED_RESUME_CANNOT_DELETE');
    }

    // Use domain logic
    resume.markAsDeleted();

    await this.resumeRepository.update(resume, tx);
  }

  /**
   * Find resume by ID
   */
  async findById(resumeId: string, tx?: DrizzleTransaction): Promise<ResumeEntity | null> {
    return this.resumeRepository.findById(resumeId, tx);
  }

  /**
   * Bill resume
   * 
   * Core business logic: validates rules, updates status, registers service
   */
  async billResume(
    resumeId: string,
    params: {
      mentorId: string;
      description?: string;
    },
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<ResumeEntity> {
    const executor = tx ?? this.db;
    const resume = await this.resumeRepository.findById(resumeId, tx);
    
    if (!resume) {
      throw new ResumeNotFoundException(resumeId);
    }

    // Validate business rules using domain logic
    resume.validateBilling();

    // Check for duplicate billing on same job title
    const [billedResume] = await executor
      .select()
      .from(resumes)
      .where(
        eq(resumes.studentUserId, resume.getStudentUserId()),
      )
      .limit(1);

    if (billedResume && billedResume.billedAt && billedResume.id !== resumeId) {
      throw new BadRequestException('JOB_TITLE_ALREADY_BILLED');
    }

    // Mark as billed
    resume.markAsBilled();

    // Update in DB
    const [updated] = await executor
      .update(resumes)
      .set({
        mentorUserId: params.mentorId,
        billedAt: resume.getBilledAt(),
        description: params.description ?? null,
        updatedAt: resume.getUpdatedAt(),
      })
      .where(eq(resumes.id, resumeId))
      .returning();

    // Register service reference
    await this.serviceRegistryService.registerService({
      id: resume.getId(),
      service_type: resume.getSessionType(),
      title: `${resume.getJobTitle()} Resume Review`,
      student_user_id: resume.getStudentUserId(),
      provider_user_id: params.mentorId,
      consumed_units: 1.0,
      unit_type: 'count',
      completed_time: new Date(),
    }, tx);

    // Publish event if not in transaction
    if (!tx) {
      this.eventEmitter.emit(RESUME_BILLED_EVENT, {
        resumeId: resume.getId(),
        studentId: resume.getStudentUserId(),
        mentorId: params.mentorId,
        jobTitle: resume.getJobTitle(),
        description: params.description,
        billedAt: resume.getBilledAt(),
      });
    }

    return this.resumeRepository.findById(resumeId, tx) as Promise<ResumeEntity>;
  }

  /**
   * Cancel resume billing
   * 
   * Clears billing info and deletes service reference
   */
  async cancelBillResume(
    resumeId: string,
    params: {
      description?: string;
    },
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<ResumeEntity> {
    const executor = tx ?? this.db;
    const resume = await this.resumeRepository.findById(resumeId, tx);
    
    if (!resume) {
      throw new ResumeNotFoundException(resumeId);
    }

    if (!resume.getMentorUserId()) {
      throw new BadRequestException('RESUME_NOT_BILLED');
    }

    const previousMentorId = resume.getMentorUserId();

    // Cancel billing
    resume.cancelBilling();

    // Update in DB
    await executor
      .update(resumes)
      .set({
        mentorUserId: null,
        billedAt: null,
        description: params.description ?? null,
        updatedAt: resume.getUpdatedAt(),
      })
      .where(eq(resumes.id, resumeId));

    // Delete service reference
    await executor
      .delete(serviceReferences)
      .where(eq(serviceReferences.id, resumeId));

    // Publish event if not in transaction
    if (!tx) {
      this.eventEmitter.emit(RESUME_BILL_CANCELLED_EVENT, {
        resumeId: resume.getId(),
        studentId: resume.getStudentUserId(),
        mentorId: previousMentorId,
        jobTitle: resume.getJobTitle(),
        description: params.description,
        cancelledAt: new Date(),
      });
    }

    return this.resumeRepository.findById(resumeId, tx) as Promise<ResumeEntity>;
  }
}

