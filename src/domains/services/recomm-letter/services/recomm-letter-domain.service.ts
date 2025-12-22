import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { IRecommLetterRepository, RECOMM_LETTER_REPOSITORY } from '../repositories/recomm-letter.repository.interface';
import { RecommLetterEntity } from '../entities/recomm-letter.entity';
import { RecommLetterStatus } from '../value-objects/recomm-letter-status.vo';
import { InvalidRecommLetterUrlException, RecommLetterNotFoundException } from '../exceptions';
import { ServiceRegistryService } from '@domains/services/service-registry/services/service-registry.service';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { recommLetters, serviceReferences } from '@infrastructure/database/schema';
import { v4 as uuidv4 } from 'uuid';

/**
 * Domain Service - Recommendation Letter Business Logic
 * 
 * Pure business logic for recommendation letter operations
 */
@Injectable()
export class RecommLetterDomainService {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    @Inject(RECOMM_LETTER_REPOSITORY)
    private readonly recommLetterRepository: IRecommLetterRepository,
    private readonly serviceRegistryService: ServiceRegistryService,
  ) {}

  /**
   * Upload new recommendation letter
   */
  async upload(params: {
    studentUserId: string;
    letterTypeId: string;
    packageTypeId?: string;
    serviceType: string;
    fileName: string;
    fileUrl: string;
    uploadedBy: string;
  }): Promise<RecommLetterEntity> {
    // Validate URL format
    if (!params.fileUrl.startsWith('https://') && !params.fileUrl.startsWith('s3://')) {
      throw new InvalidRecommLetterUrlException(params.fileUrl);
    }

    const entity = RecommLetterEntity.create({
      id: uuidv4(),
      studentUserId: params.studentUserId,
      letterTypeId: params.letterTypeId,
      packageTypeId: params.packageTypeId,
      serviceType: params.serviceType,
      fileName: params.fileName,
      fileUrl: params.fileUrl,
      status: RecommLetterStatus.UPLOADED,
      uploadedBy: params.uploadedBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.recommLetterRepository.create(entity);
  }

  /**
   * List recommendation letters by student
   */
  async listByStudent(studentUserId: string): Promise<RecommLetterEntity[]> {
    return this.recommLetterRepository.findAllByStudent(studentUserId);
  }

  /**
   * Delete recommendation letter (soft delete)
   */
  async delete(letterId: string, userId: string, tx?: DrizzleTransaction): Promise<void> {
    const letter = await this.recommLetterRepository.findById(letterId, tx);
    
    if (!letter) {
      throw new RecommLetterNotFoundException(letterId);
    }

    // Use domain logic - will throw if already billed
    letter.markAsDeleted();

    await this.recommLetterRepository.update(letter, tx);
  }

  /**
   * Find recommendation letter by ID
   */
  async findById(letterId: string, tx?: DrizzleTransaction): Promise<RecommLetterEntity | null> {
    return this.recommLetterRepository.findById(letterId, tx);
  }

  /**
   * Bill recommendation letter
   * 
   * Core business logic: validates rules, updates status, registers service
   */
  async billRecommLetter(
    letterId: string,
    params: {
      mentorId: string;
      description?: string;
      letterTypeCode: string;
      packageTypeCode?: string;
    },
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<RecommLetterEntity> {
    const executor = tx ?? this.db;
    const letter = await this.recommLetterRepository.findById(letterId, tx);
    
    if (!letter) {
      throw new RecommLetterNotFoundException(letterId);
    }

    // Validate business rules using domain logic
    letter.validateBilling();

    // Mark as billed
    letter.markAsBilled(params.mentorId, params.description);

    // Update in DB
    await executor
      .update(recommLetters)
      .set({
        mentorUserId: params.mentorId,
        billedAt: letter.getBilledAt(),
        description: params.description ?? null,
        updatedAt: letter.getUpdatedAt(),
      })
      .where(eq(recommLetters.id, letterId));

    // Register service reference
    const title = params.packageTypeCode 
      ? `${params.letterTypeCode} - ${params.packageTypeCode}`
      : params.letterTypeCode;

    await this.serviceRegistryService.registerService({
      id: letter.getId(),
      service_type: letter.getServiceType(),
      title: `Recommendation Letter: ${title}`,
      student_user_id: letter.getStudentUserId(),
      provider_user_id: params.mentorId,
      consumed_units: 1.0,
      unit_type: 'count',
      completed_time: new Date(),
    }, tx);

    return this.recommLetterRepository.findById(letterId, tx) as Promise<RecommLetterEntity>;
  }

  /**
   * Cancel recommendation letter billing
   * 
   * Clears billing info and deletes service reference
   */
  async cancelBillRecommLetter(
    letterId: string,
    params: {
      description?: string;
      letterTypeCode: string;
      packageTypeCode?: string;
    },
    userId: string,
    tx?: DrizzleTransaction,
  ): Promise<RecommLetterEntity> {
    const executor = tx ?? this.db;
    const letter = await this.recommLetterRepository.findById(letterId, tx);
    
    if (!letter) {
      throw new RecommLetterNotFoundException(letterId);
    }

    if (!letter.getMentorUserId()) {
      throw new BadRequestException('RECOMM_LETTER_NOT_BILLED');
    }

    const previousMentorId = letter.getMentorUserId();

    // Cancel billing
    letter.cancelBilling(params.description);

    // Update in DB
    await executor
      .update(recommLetters)
      .set({
        mentorUserId: null,
        billedAt: null,
        description: params.description ?? null,
        updatedAt: letter.getUpdatedAt(),
      })
      .where(eq(recommLetters.id, letterId));

    // Delete service reference
    await executor
      .delete(serviceReferences)
      .where(eq(serviceReferences.id, letterId));

    return this.recommLetterRepository.findById(letterId, tx) as Promise<RecommLetterEntity>;
  }
}

