import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { GetSessionTypesQuery } from '@application/queries/services/get-session-types.query';
import { SessionTypesQueryService } from '@domains/services/session-types/services/session-types-query.service';
import { GetSessionTypesDto, SessionTypeDto } from '@domains/services/session-types/dto/get-session-types.dto';

/**
 * Session Types Controller
 * 
 * Provides API endpoints for querying session types
 */
@ApiTags("Session Types")
@Controller('api/services/session-types')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
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
  @ApiOperation({ summary: "Get session types list" })
  @ApiQuery({
    name: "code",
    required: false,
    description: "Filter by session type code (External | Internal)",
    enum: ['External', 'Internal'],
  })
  @ApiOkResponse({
    description: "Session types retrieved successfully",
    type: SessionTypeDto,
    isArray: true,
  })
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
  @ApiOperation({ summary: "Get session type by ID" })
  @ApiParam({
    name: "id",
    description: "Session type ID",
    type: String,
  })
  @ApiOkResponse({
    description: "Session type retrieved successfully",
    type: SessionTypeDto,
  })
  async getSessionTypeById(@Param('id') id: string): Promise<SessionTypeDto> {
    return this.sessionTypesQueryService.getSessionTypeById(id);
  }
}

