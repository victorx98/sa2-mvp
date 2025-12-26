import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { GetSessionTypesUseCase } from '@application/queries/services/session-types/use-cases/get-session-types.use-case';
import { ApiPrefix } from '@api/api.constants';
import { GetSessionTypesRequestDto } from '@api/dto/request/services/session-types';
import { SessionTypeResponseDto, SessionTypeItemResponseDto } from '@api/dto/response/services/session-types';
import { SessionTypeReadModel } from '@application/queries/services/session-types/models/session-type-read.model';

@ApiTags("Session Types")
@Controller(`${ApiPrefix}/services/session-types`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionTypesController {
  constructor(
    private readonly getSessionTypesUseCase: GetSessionTypesUseCase,
  ) {}

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
    const readModels = await this.getSessionTypesUseCase.execute(filters);
    return this.toResponseDtos(readModels);
  }

  private toResponseDtos(readModels: SessionTypeReadModel[]): SessionTypeResponseDto[] {
    const grouped = new Map<string, SessionTypeItemResponseDto[]>();
    
    for (const model of readModels) {
      const serviceTypeCode = model.serviceTypeCode || '';
      if (!grouped.has(serviceTypeCode)) {
        grouped.set(serviceTypeCode, []);
      }
      grouped.get(serviceTypeCode)!.push({
        id: model.id,
        code: model.code,
        name: { zh: model.nameZh, en: model.nameEn },
        isBilling: model.isBilling,
      });
    }

    const responses: SessionTypeResponseDto[] = [];
    for (const [serviceTypeCode, sessionTypes] of grouped) {
      const response = new SessionTypeResponseDto();
      response.serviceTypeCode = serviceTypeCode;
      response.sessionTypes = sessionTypes;
      responses.push(response);
    }

    return responses;
  }
}
