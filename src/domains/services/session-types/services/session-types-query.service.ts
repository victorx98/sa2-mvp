import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionTypesRepository } from '../session-types.repository';
import { GetSessionTypesDto, SessionTypeDto } from '../dto/get-session-types.dto';

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

    return sessionTypes.map(this.toDto);
  }

  async getSessionTypeById(id: string): Promise<SessionTypeDto> {
    const sessionType = await this.sessionTypesRepository.findOne(id);
    if (!sessionType) {
      throw new NotFoundException(`Session type with ID ${id} not found`);
    }
    return this.toDto(sessionType);
  }

  private toDto(entity: any): SessionTypeDto {
    return {
      id: entity.id,
      code: entity.code,
      name: entity.name,
      serviceTypeCode: entity.serviceTypeCode,
      templateId: entity.templateId,
      isBilling: entity.isBilling,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}

