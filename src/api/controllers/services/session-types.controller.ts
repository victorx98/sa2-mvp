import { Controller, Get, Param, Query } from '@nestjs/common';
import { GetSessionTypesQuery } from '@application/queries/services/get-session-types.query';
import { SessionTypesQueryService } from '@domains/services/session-types/services/session-types-query.service';
import { GetSessionTypesDto, SessionTypeDto } from '@domains/services/session-types/dto/get-session-types.dto';

/**
 * Session Types Controller
 * 
 * Provides API endpoints for querying session types
 */
@Controller('api/services/session-types')
export class SessionTypesController {
  constructor(
    private readonly getSessionTypesQuery: GetSessionTypesQuery,
    private readonly sessionTypesQueryService: SessionTypesQueryService,
  ) {}

  /**
   * Get session types list
   * 
   * @param filters - Query filters (code: External | Internal)
   * @returns List of session types
   */
  @Get()
  async getSessionTypes(
    @Query() filters: GetSessionTypesDto,
  ): Promise<SessionTypeDto[]> {
    return this.getSessionTypesQuery.execute(filters);
  }

  /**
   * Get session type by ID
   * 
   * @param id - Session type ID
   * @returns Session type details
   */
  @Get(':id')
  async getSessionTypeById(@Param('id') id: string): Promise<SessionTypeDto> {
    return this.sessionTypesQueryService.getSessionTypeById(id);
  }
}

