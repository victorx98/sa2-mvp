import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard as AuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import type { IJwtUser } from "@shared/types/jwt-user.interface";
import { CreateProxyApplicationsBatchCommand } from "@application/commands/placement/create-proxy-applications-batch.command";
import { PlacementProxyBatchRequestDto } from "@api/dto/request/placement-proxy-batch.request.dto";
import { BatchJobApplicationsResponseDto, JobApplicationResponseDto } from "@api/dto/response/placement/placement.response.dto";

@Controller("api/placement")
@ApiTags("Placement")
@UseGuards(AuthGuard, RolesGuard)
@Roles("counselor")
@ApiBearerAuth()
export class PlacementProxyController {
  constructor(
    private readonly createProxyApplicationsBatchCommand: CreateProxyApplicationsBatchCommand,
  ) {}

  @Post("proxy/batch")
  @ApiOperation({
    summary: "Batch create proxy applications",
    description:
      "Counselor creates proxy applications for students (all-or-nothing). [顾问批量为学生代投岗位(全成功事务)]",
  })
  @ApiBody({ type: PlacementProxyBatchRequestDto })
  @ApiCreatedResponse({
    description: "Proxy applications created",
    type: BatchJobApplicationsResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async batchCreateProxyApplications(
    @Body() body: PlacementProxyBatchRequestDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<BatchJobApplicationsResponseDto> {
    const createdBy = String((user as unknown as { id: string }).id);
    const result = await this.createProxyApplicationsBatchCommand.execute({
      dto: {
        createdBy,
        studentIds: body.studentIds,
        jobs: body.jobs,
      },
    });
    return {
      items: result.data.items as unknown as JobApplicationResponseDto[],
    };
  }
}

