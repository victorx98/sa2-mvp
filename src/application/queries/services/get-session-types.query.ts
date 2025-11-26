import { Injectable } from '@nestjs/common';
import { SessionTypesQueryService } from '@domains/services/session-types/services/session-types-query.service';
import { GetSessionTypesDto, SessionTypeDto } from '@domains/services/session-types/dto/get-session-types.dto';

/**
 * Get Session Types Query (Application Layer)
 * 
 * Handles fetching session types for booking
 */
@Injectable()
export class GetSessionTypesQuery {
  constructor(
    private readonly sessionTypesQueryService: SessionTypesQueryService,
  ) {}

  async execute(filters: GetSessionTypesDto): Promise<SessionTypeDto[]> {
    return this.sessionTypesQueryService.getSessionTypes(filters);
  }
}

