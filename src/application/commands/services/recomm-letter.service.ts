import { Inject, Injectable, Logger } from '@nestjs/common';
import { RecommLetterDomainService } from '@domains/services/recomm-letter/services/recomm-letter-domain.service';
import { ServiceHoldService } from '@domains/contract/services/service-hold.service';
import { RecommLetterTypesService } from '@domains/services/recomm-letter-types/services/recomm-letter-types.service';
import { GetUserUseCase } from '@application/queries/identity/use-cases/get-user.use-case';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import type { DrizzleDatabase, DrizzleTransaction } from '@shared/types/database.types';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecommLetterEntity } from '@domains/services/recomm-letter/entities/recomm-letter.entity';
import {
  IntegrationEventPublisher,
  RecommLetterBillCancelledEvent,
  RecommLetterBilledEvent,
} from '@application/events';

@Injectable()
export class RecommLetterService {
  private readonly logger = new Logger(RecommLetterService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: DrizzleDatabase,
    private readonly domainRecommLetterService: RecommLetterDomainService,
    private readonly serviceHoldService: ServiceHoldService,
    private readonly recommLetterTypesService: RecommLetterTypesService,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly eventPublisher: IntegrationEventPublisher,
  ) {}

  async listLettersWithDetails(studentUserId: string) {
    const letters = await this.domainRecommLetterService.listByStudent(studentUserId);

    const letterTypeIds = [...new Set(letters.map(l => l.getLetterTypeId()))];
    const packageTypeIds = [...new Set(
      letters.map(l => l.getPackageTypeId()).filter(Boolean)
    )] as string[];
    const userIds = [...new Set([
      ...letters.map(l => l.getMentorUserId()).filter(Boolean),
      ...letters.map(l => l.getUploadedBy()).filter(Boolean),
      ...letters.map(l => l.getBilledBy()).filter(Boolean),
    ])] as string[];

    const [letterTypes, packageTypes, users] = await Promise.all([
      this.recommLetterTypesService.findByIds(letterTypeIds),
      packageTypeIds.length > 0 
        ? this.recommLetterTypesService.findByIds(packageTypeIds) 
        : Promise.resolve([]),
      userIds.length > 0 
        ? this.getUserUseCase.getUsersByIds(userIds) 
        : Promise.resolve([]),
    ]);

    const letterTypeMap = new Map(letterTypes.map(t => [t.id, t]));
    const packageTypeMap = new Map(packageTypes.map(t => [t.id, t]));
    const userMap = new Map(users.map(u => [u.id, u]));

    return letters.map(letter => {
      const letterType = letterTypeMap.get(letter.getLetterTypeId());
      const packageType = letter.getPackageTypeId() 
        ? packageTypeMap.get(letter.getPackageTypeId()!) 
        : null;
      const mentor = letter.getMentorUserId() 
        ? userMap.get(letter.getMentorUserId()!) 
        : null;
      const uploadedByUser = letter.getUploadedBy()
        ? userMap.get(letter.getUploadedBy())
        : null;
      const billedByUser = letter.getBilledBy()
        ? userMap.get(letter.getBilledBy()!)
        : null;

      return {
        id: letter.getId(),
        studentUserId: letter.getStudentUserId(),
        letterType: letterType ? {
          id: letterType.id,
          code: letterType.typeCode,
          name: letterType.typeName,
        } : undefined,
        packageType: packageType ? {
          id: packageType.id,
          code: packageType.typeCode,
          name: packageType.typeName,
        } : undefined,
        serviceType: letter.getServiceType(),
        fileName: letter.getFileName(),
        fileUrl: letter.getFileUrl(),
        status: letter.getStatus(),
        uploadedBy: letter.getUploadedBy(),
        uploadedName: uploadedByUser ? {
          en: uploadedByUser.nameEn || uploadedByUser.email,
          zh: uploadedByUser.nameZh || uploadedByUser.nameEn || uploadedByUser.email,
        } : undefined,
        createdAt: letter.getCreatedAt(),
        updatedAt: letter.getUpdatedAt(),
        description: letter.getDescription(),
        mentorUserId: letter.getMentorUserId(),
        mentorName: mentor ? {
          en: mentor.nameEn || mentor.email,
          zh: mentor.nameZh || mentor.nameEn || mentor.email,
        } : undefined,
        billedBy: letter.getBilledBy(),
        billedName: billedByUser ? {
          en: billedByUser.nameEn || billedByUser.email,
          zh: billedByUser.nameZh || billedByUser.nameEn || billedByUser.email,
        } : undefined,
        billedAt: letter.getBilledAt(),
      };
    });
  }

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
      const letter = await this.domainRecommLetterService.findById(letterId);
      if (!letter) {
        throw new NotFoundException('RECOMM_LETTER_NOT_FOUND');
      }

      const letterType = await this.recommLetterTypesService.findById(letter.getLetterTypeId());
      if (!letterType) {
        throw new BadRequestException('LETTER_TYPE_NOT_FOUND');
      }

      let packageType = null;
      if (letter.getPackageTypeId()) {
        packageType = await this.recommLetterTypesService.findById(letter.getPackageTypeId()!);
      }

      const result = await this.db.transaction(async (tx: DrizzleTransaction) => {
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

      const eventPayload = {
        sessionId: result.getId(),
        studentId: result.getStudentUserId(),
        mentorId: params.mentorId,
        referenceId: result.getId(),
        serviceTypeCode: result.getServiceType(),
        letterType: letterType.typeCode,
        packageType: packageType?.typeCode,
        description: params.description,
        billedAt: result.getBilledAt(),
      };
      await this.eventPublisher.publish(
        new RecommLetterBilledEvent(eventPayload),
        RecommLetterService.name,
      );
      this.logger.log(`🎉 [RECOMM_LETTER_BILLED_EVENT] Published: ${JSON.stringify(eventPayload, null, 2)}`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to bill recommendation letter: ${error.message}`, error.stack);
      throw error;
    }
  }

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
      const letter = await this.domainRecommLetterService.findById(letterId);
      if (!letter) {
        throw new NotFoundException('RECOMM_LETTER_NOT_FOUND');
      }

      if (!letter.getMentorUserId()) {
        throw new BadRequestException('This recommendation letter has not been billed and cannot cancel billing');
      }

      const previousMentorId = letter.getMentorUserId();

      const letterType = await this.recommLetterTypesService.findById(letter.getLetterTypeId());
      if (!letterType) {
        throw new BadRequestException('LETTER_TYPE_NOT_FOUND');
      }

      let packageType = null;
      if (letter.getPackageTypeId()) {
        packageType = await this.recommLetterTypesService.findById(letter.getPackageTypeId()!);
      }

      const result = await this.db.transaction(async (tx: DrizzleTransaction) => {
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

      const eventPayload = {
        sessionId: result.getId(),
        studentId: result.getStudentUserId(),
        mentorId: previousMentorId,
        referenceId: result.getId(),
        serviceTypeCode: result.getServiceType(),
        letterType: letterType.typeCode,
        packageType: packageType?.typeCode,
        description: params.description,
        cancelledAt: new Date(),
      };
      await this.eventPublisher.publish(
        new RecommLetterBillCancelledEvent(eventPayload),
        RecommLetterService.name,
      );
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
