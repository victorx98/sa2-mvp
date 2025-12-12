import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionTypesRepository } from '../session-types.repository';
import { GetSessionTypesDto, SessionTypeDto, SessionTypeItemDto } from '../dto/get-session-types.dto';

/**
 * Session Types Query Service (CQRS - Query)
 * 
 * Handles read operations for session types
 */
@Injectable()
export class SessionTypesQueryService {
  constructor(
    private readonly sessionTypesRepository: SessionTypesRepository,
  ) {}

  async getSessionTypes(filters: GetSessionTypesDto): Promise<SessionTypeDto[]> {
    let sessionTypes;

    if (filters.serviceTypeCode) {
      sessionTypes = await this.sessionTypesRepository.findByServiceTypeCode(filters.serviceTypeCode);
    } else {
      sessionTypes = await this.sessionTypesRepository.findAll();
    }

    // Group by serviceTypeCode
    const grouped: Record<string, SessionTypeItemDto[]> = {};
    for (const entity of sessionTypes) {
      const serviceTypeCode = entity.serviceTypeCode;
      if (!grouped[serviceTypeCode]) {
        grouped[serviceTypeCode] = [];
      }
      grouped[serviceTypeCode].push(this.toItemDto(entity));
    }

    // Convert to array format
    return Object.entries(grouped).map(([serviceTypeCode, sessionTypes]): SessionTypeDto => ({
      serviceTypeCode,
      sessionTypes,
    }));
  }

  async getSessionTypeById(id: string): Promise<SessionTypeItemDto> {
    const sessionType = await this.sessionTypesRepository.findOne(id);
    if (!sessionType) {
      throw new NotFoundException(`Session type with ID ${id} not found`);
    }
    return this.toItemDto(sessionType);
  }

  private toItemDto(entity: any): SessionTypeItemDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      isBilling: entity.isBilling,
    };
  }
}

