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
import { GetRecommLetterTypesUseCase } from '@application/queries/services/recomm-letter-types/use-cases/get-recomm-letter-types.use-case';
import { RecommLetterTypeService } from '@application/commands/services/recomm-letter-type.service';
import { CreateRecommLetterTypeDto } from '@api/dto/request/services/recomm-letter-types';
import { RecommLetterTypeResponseDto, AvailableTypesResponseDto } from '@api/dto/response/services/recomm-letter-types';
import { RecommLetterTypeReadModel } from '@application/queries/services/recomm-letter-types/models/recomm-letter-type-read.model';

@ApiTags('Recommendation Letter Types')
@Controller(`${ApiPrefix}/services/recomm-letter-types`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecommLetterTypesController {
  constructor(
    private readonly getRecommLetterTypesUseCase: GetRecommLetterTypesUseCase,
    private readonly recommLetterTypeService: RecommLetterTypeService,
  ) {}

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
    const readModels = await this.getRecommLetterTypesUseCase.execute({ serviceTypeCode });
    return this.toResponseDtos(readModels);
  }

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

  @Get(':studentId/available')
  @ApiOperation({
    summary: 'Get available recommendation letter types for student',
    description: 'Retrieve recommendation letter types that student can still upload based on contract balance with statistics summary',
  })
  @ApiParam({
    name: 'studentId',
    description: 'Student user ID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Available types retrieved successfully with statistics',
    type: AvailableTypesResponseDto,
  })
  async getAvailableTypes(
    @Param('studentId') studentId: string,
  ): Promise<AvailableTypesResponseDto> {
    return this.recommLetterTypeService.getAvailableTypes(studentId);
  }

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

  private toResponseDtos(readModels: RecommLetterTypeReadModel[]): RecommLetterTypeResponseDto[] {
    const modelMap = new Map<string, RecommLetterTypeResponseDto>();
    
    for (const model of readModels) {
      const dto = new RecommLetterTypeResponseDto();
      dto.id = model.id;
      dto.typeCode = model.code;
      dto.typeName = model.nameZh;
      dto.serviceTypeCode = model.serviceTypeCode || '';
      dto.parentId = model.parentId;
      dto.active = model.isActive;
      dto.children = [];
      dto.createdAt = model.createdAt;
      dto.updatedAt = model.updatedAt;
      modelMap.set(model.id, dto);
    }

    for (const model of readModels) {
      const dto = modelMap.get(model.id)!;
      if (model.parentId) {
        const parentDto = modelMap.get(model.parentId);
        if (parentDto) {
          parentDto.children.push(dto);
        }
      }
    }

    return Array.from(modelMap.values()).filter(d => !d.parentId);
  }
}
