import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RecommLetterDomainService } from '@domains/services/recomm-letter/services/recomm-letter-domain.service';
import { ServiceHoldService } from '@domains/contract/services/service-hold.service';
import { RecommLetterTypesService } from '@domains/services/recomm-letter-types/services/recomm-letter-types.service';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecommLetterEntity } from '@domains/services/recomm-letter/entities/recomm-letter.entity';
import { RECOMM_LETTER_BILLED_EVENT, RECOMM_LETTER_BILL_CANCELLED_EVENT } from '@shared/events/event-constants';

/**
 * Application Layer - Recommendation Letter Service
 *
 * Orchestrates recommendation letter billing operations with service hold management
 * Coordinates between Domain Services (RecommLetter, ServiceHold, RecommLetterTypes)
 */
@Injectable()
export class RecommLetterService {
  private readonly logger = new Logger(RecommLetterService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainRecommLetterService: RecommLetterDomainService,
    private readonly serviceHoldService: ServiceHoldService,
    private readonly recommLetterTypesService: RecommLetterTypesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Bill recommendation letter with service hold validation
   * 
   * Flow:
   * 1. Get letter type info
   * 2. Create service hold (check balance)
   * 3. Call domain layer billing logic
   * 
   * @param letterId Recommendation letter ID
   * @param params Billing params (mentorId, description, studentId, serviceType)
   * @param userId Counselor ID
   */
  async billRecommLetter(
    letterId: string,
    params: {
      mentorId: string;
      description?: string;
      studentId: string;
      serviceType?: string;
    },
    userId: string,
  ): Promise<RecommLetterEntity> {
    this.logger.log(`Billing recommendation letter: letterId=${letterId}, studentId=${params.studentId}`);

    try {
      // Get letter info to fetch type codes
      const letter = await this.domainRecommLetterService.findById(letterId);
      if (!letter) {
        throw new NotFoundException('RECOMM_LETTER_NOT_FOUND');
      }

      // Get letter type and package type info
      const letterType = await this.recommLetterTypesService.findById(letter.getLetterTypeId());
      if (!letterType) {
        throw new BadRequestException('LETTER_TYPE_NOT_FOUND');
      }

      let packageType = null;
      if (letter.getPackageTypeId()) {
        packageType = await this.recommLetterTypesService.findById(letter.getPackageTypeId()!);
      }

      // Execute in transaction
      const result = await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Step 1: Create service hold (check and reserve balance)
        const hold = await this.serviceHoldService.createHold(
          {
            studentId: params.studentId,
            serviceType: params.serviceType || letter.getServiceType(),
            quantity: 1,
            createdBy: userId,
          },
          tx,
        );

        this.logger.debug(`Service hold created: ${hold.id}`);

        // Step 2: Call domain layer billing logic
        const result = await this.domainRecommLetterService.billRecommLetter(
          letterId,
          {
            mentorId: params.mentorId,
            description: params.description,
            letterTypeCode: letterType.typeCode,
            packageTypeCode: packageType?.typeCode,
          },
          userId,
          tx,
        );

        return result;
      });

      // Step 3: Publish event after transaction committed
      const eventPayload = {
        sessionId: result.getId(),
        studentId: result.getStudentUserId(),
        mentorId: params.mentorId,
        refrenceId: result.getId(),
        serviceTypeCode: result.getServiceType(),
        letterType: letterType.typeCode,
        packageType: packageType?.typeCode,
        description: params.description,
        billedAt: result.getBilledAt(),
      };
      this.eventEmitter.emit(RECOMM_LETTER_BILLED_EVENT, eventPayload);
      this.logger.log(`🎉 [RECOMM_LETTER_BILLED_EVENT] Published: ${JSON.stringify(eventPayload, null, 2)}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to bill recommendation letter: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Cancel recommendation letter billing with service hold release
   * 
   * Flow:
   * 1. Cancel billing in domain layer
   * 2. Release service hold
   * 
   * @param letterId Recommendation letter ID
   * @param params Cancel params (description, serviceType)
   * @param userId Counselor ID
   */
  async cancelBillRecommLetter(
    letterId: string,
    params: {
      description?: string;
      serviceType?: string;
    },
    userId: string,
  ): Promise<RecommLetterEntity> {
    this.logger.log(`Canceling recommendation letter billing: letterId=${letterId}`);

    try {
      // Get letter to find related hold
      const letter = await this.domainRecommLetterService.findById(letterId);
      if (!letter) {
        throw new NotFoundException('RECOMM_LETTER_NOT_FOUND');
      }

      if (!letter.getMentorUserId()) {
        throw new BadRequestException('This recommendation letter has not been billed and cannot cancel billing');
      }

      const previousMentorId = letter.getMentorUserId();

      // Get letter type info
      const letterType = await this.recommLetterTypesService.findById(letter.getLetterTypeId());
      if (!letterType) {
        throw new BadRequestException('LETTER_TYPE_NOT_FOUND');
      }

      let packageType = null;
      if (letter.getPackageTypeId()) {
        packageType = await this.recommLetterTypesService.findById(letter.getPackageTypeId()!);
      }

      // Execute in transaction
      const result = await this.db.transaction(async (tx: DrizzleTransaction) => {
        // Step 1: Cancel billing in domain layer
        const result = await this.domainRecommLetterService.cancelBillRecommLetter(
          letterId,
          {
            description: params.description,
            letterTypeCode: letterType.typeCode,
            packageTypeCode: packageType?.typeCode,
          },
          userId,
          tx,
        );

        // Step 2: Find and release related hold
        const activeHolds = await this.serviceHoldService.getActiveHolds(
          letter.getStudentUserId(),
          params.serviceType || letter.getServiceType(),
        );

        const relatedHold = activeHolds.find(
          (h) => h.relatedBookingId === letterId,
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
            `No active hold found for recommendation letter ${letterId}, skipping hold release`,
          );
        }

        return result;
      });

      // Step 3: Publish event after transaction committed
      const eventPayload = {
        sessionId: result.getId(),
        studentId: result.getStudentUserId(),
        mentorId: previousMentorId,
        refrenceId: result.getId(),
        serviceTypeCode: result.getServiceType(),
        letterType: letterType.typeCode,
        packageType: packageType?.typeCode,
        description: params.description,
        cancelledAt: new Date(),
      };
      this.eventEmitter.emit(RECOMM_LETTER_BILL_CANCELLED_EVENT, eventPayload);
      this.logger.log(`🔄 [RECOMM_LETTER_BILL_CANCELLED_EVENT] Published: ${JSON.stringify(eventPayload, null, 2)}`);

      return result;
    } catch (error) {
      this.logger.error(
        `Failed to cancel recommendation letter billing: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

