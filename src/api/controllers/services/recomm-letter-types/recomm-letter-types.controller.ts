import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { ApiPrefix } from '@api/api.constants';
import { GetRecommLetterTypesQuery } from '@application/queries/services/get-recomm-letter-types.query';
import { RecommLetterTypeService } from '@application/commands/services/recomm-letter-type.service';
import { CreateRecommLetterTypeDto } from '@api/dto/request/services/recomm-letter-types';
import { RecommLetterTypeResponseDto } from '@api/dto/response/services/recomm-letter-types';

/**
 * Recommendation Letter Types Controller
 * 
 * Provides API endpoints for managing recommendation letter types
 */
@ApiTags('Recommendation Letter Types')
@Controller(`${ApiPrefix}/services/recomm-letter-types`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecommLetterTypesController {
  constructor(
    private readonly getRecommLetterTypesQuery: GetRecommLetterTypesQuery,
    private readonly recommLetterTypeService: RecommLetterTypeService,
  ) {}

  /**
   * Get recommendation letter types tree
   * GET /api/services/recomm-letter-types
   */
  @Get()
  @ApiOperation({
    summary: 'Get recommendation letter types',
    description: 'Retrieve recommendation letter types as tree structure with parent-children relationships, optionally filtered by service type code',
  })
  @ApiQuery({
    name: 'serviceTypeCode',
    required: false,
    description: 'Filter by service type code (e.g., External, Internal)',
    example: 'External',
  })
  @ApiOkResponse({
    description: 'Types retrieved successfully',
    type: RecommLetterTypeResponseDto,
    isArray: true,
  })
  async getTypes(
    @Query('serviceTypeCode') serviceTypeCode?: string,
  ): Promise<RecommLetterTypeResponseDto[]> {
    return this.getRecommLetterTypesQuery.execute(serviceTypeCode);
  }

  /**
   * Create new recommendation letter type
   * POST /api/services/recomm-letter-types
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Create recommendation letter type',
    description: 'Create a new recommendation letter type (counselor/admin only)',
  })
  @ApiCreatedResponse({
    description: 'Type created successfully',
    type: RecommLetterTypeResponseDto,
  })
  async createType(
    @Body() dto: CreateRecommLetterTypeDto,
  ): Promise<RecommLetterTypeResponseDto> {
    return this.recommLetterTypeService.create(dto) as any;
  }

  /**
   * Get available recommendation letter types for student
   * GET /api/services/recomm-letter-types/:studentId/available
   */
  @Get(':studentId/available')
  @ApiOperation({
    summary: 'Get available recommendation letter types for student',
    description: 'Retrieve recommendation letter types that student can still upload based on contract balance',
  })
  @ApiParam({
    name: 'studentId',
    description: 'Student user ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Available types retrieved successfully',
    type: RecommLetterTypeResponseDto,
    isArray: true,
  })
  async getAvailableTypes(
    @Param('studentId') studentId: string,
  ): Promise<RecommLetterTypeResponseDto[]> {
    return this.recommLetterTypeService.getAvailableTypes(studentId);
  }

  /**
   * Delete recommendation letter type
   * DELETE /api/services/recomm-letter-types/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles('counselor', 'admin')
  @ApiOperation({
    summary: 'Delete recommendation letter type',
    description: 'Delete a recommendation letter type (cascade delete children, counselor/admin only)',
  })
  @ApiParam({
    name: 'id',
    description: 'Type ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Type deleted successfully',
  })
  async deleteType(@Param('id') id: string): Promise<{ message: string }> {
    await this.recommLetterTypeService.delete(id);
    return { message: 'Type deleted successfully' };
  }
}

