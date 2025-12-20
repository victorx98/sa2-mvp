import { Injectable } from '@nestjs/common';
import { SessionTypesQueryService } from '@domains/services/session-types/services/session-types-query.service';

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

  async execute(filters: { serviceTypeCode?: string }): Promise<any[]> {
    return this.sessionTypesQueryService.getSessionTypes(filters);
  }
}

