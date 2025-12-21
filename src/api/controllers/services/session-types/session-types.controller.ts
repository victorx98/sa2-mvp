import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { GetSessionTypesQuery } from '@application/queries/services/get-session-types.query';
import { ApiPrefix } from '@api/api.constants';
import {
  GetSessionTypesRequestDto,
  SessionTypeResponseDto,
} from './dtos';

/**
 * Session Types Controller
 * 
 * Provides API endpoints for querying session types
 */
@ApiTags("Session Types")
@Controller(`${ApiPrefix}/services/session-types`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionTypesController {
  constructor(
    private readonly getSessionTypesQuery: GetSessionTypesQuery,
  ) {}

  /**
   * Get session types list
   * 
   * @param filters - Query filters (serviceTypeCode: External | Internal)
   * @returns List of session types grouped by service type
   */
  @Get()
  @ApiOperation({ 
    summary: "Get session types list",
    description: "Retrieve session types, optionally filtered by service type code (e.g., External, Internal)"
  })
  @ApiQuery({
    name: "serviceTypeCode",
    required: false,
    description: "Filter by service type code (e.g., External, Internal)",
    example: "External",
  })
  @ApiOkResponse({
    description: "Session types retrieved successfully",
    type: SessionTypeResponseDto,
    isArray: true,
  })
  async getSessionTypes(
    @Query() filters: GetSessionTypesRequestDto,
  ): Promise<SessionTypeResponseDto[]> {
    return this.getSessionTypesQuery.execute(filters);
  }
}

