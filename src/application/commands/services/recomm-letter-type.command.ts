import { Injectable } from '@nestjs/common';
import { RecommLetterTypesService } from '@domains/services/recomm-letter-types/services/recomm-letter-types.service';
import type { RecommLetterTypeEntity } from '@domains/services/recomm-letter-types/entities/recomm-letter-type.entity';

/**
 * Create Recommendation Letter Type DTO
 */
export interface CreateRecommLetterTypeDto {
  typeCode: string;
  typeName: string;
  serviceTypeCode: string;
  parentId?: string | null;
}

/**
 * Recommendation Letter Type Command (Application Layer)
 * 
 * Handles create and delete operations for recommendation letter types
 */
@Injectable()
export class RecommLetterTypeCommand {
  constructor(
    private readonly recommLetterTypesService: RecommLetterTypesService,
  ) {}

  /**
   * Create new recommendation letter type
   */
  async create(dto: CreateRecommLetterTypeDto): Promise<RecommLetterTypeEntity> {
    return this.recommLetterTypesService.createType({
      typeCode: dto.typeCode,
      typeName: dto.typeName,
      serviceTypeCode: dto.serviceTypeCode,
      parentId: dto.parentId,
    });
  }

  /**
   * Delete recommendation letter type
   */
  async delete(id: string): Promise<void> {
    return this.recommLetterTypesService.deleteType(id);
  }
}

