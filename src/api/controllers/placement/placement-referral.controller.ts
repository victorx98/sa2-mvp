import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard as AuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import type { IJwtUser } from "@shared/types/jwt-user.interface";
import { RecommendReferralApplicationsBatchCommand } from "@application/commands/placement/recommend-referral-applications-batch.command";
import { PlacementReferralBatchRecommendRequestDto } from "@api/dto/request/placement-referral-batch.request.dto";
import { AssignReferralMentorCommand } from "@application/commands/placement/assign-referral-mentor.command";
import { PlacementReferralAssignMentorRequestDto } from "@api/dto/request/placement-referral-assign-mentor.request.dto";
import { BatchRecommendReferralApplicationsResponseDto, JobApplicationResponseDto } from "@api/dto/response/placement/placement.response.dto";

/**
 * Placement Referral Controller [内推推荐控制器]
 * - Counselor recommends jobs to students by creating referral applications [顾问给学生推荐岗位，创建内推投递记录]
 */
@Controller("api/placement")
@ApiTags("Placement")
@UseGuards(AuthGuard, RolesGuard)
@Roles("counselor")
@ApiBearerAuth()
export class PlacementReferralController {
  constructor(
    private readonly recommendReferralApplicationsBatchCommand: RecommendReferralApplicationsBatchCommand,
    private readonly assignReferralMentorCommand: AssignReferralMentorCommand,
  ) {}

  @Post("referrals/recommendations/batch")
  @ApiOperation({
    summary: "Batch recommend referral applications",
    description:
      "Counselor recommends jobs to students by creating referral applications (all-or-nothing). [顾问批量给学生推荐岗位并创建内推投递记录(全成功事务)]",
  })
  @ApiBody({ type: PlacementReferralBatchRecommendRequestDto })
  @ApiCreatedResponse({
    description: "Referral applications recommended",
    type: BatchRecommendReferralApplicationsResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async batchRecommendReferralApplications(
    @Body() body: PlacementReferralBatchRecommendRequestDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<BatchRecommendReferralApplicationsResponseDto> {
    const recommendedBy = String((user as unknown as { id: string }).id);
    const result = await this.recommendReferralApplicationsBatchCommand.execute({
      dto: {
        recommendedBy,
        studentIds: body.studentIds,
        jobIds: body.jobIds,
      },
    });
    return {
      items: result.data.items as unknown as JobApplicationResponseDto[],
    };
  }

  /**
   * Assign mentor for a referral application [为内推投递指定导师]
   * - This endpoint is counselor-facing and intentionally separated from generic status update APIs [该接口面向顾问，刻意与通用状态更新接口分离]
   */
  @Patch("referrals/:applicationId/mentor")
  @ApiOperation({
    summary: "Assign mentor for a referral application",
    description:
      "Assigns mentor to a referral application and sets status to mentor_assigned. [为内推投递指定导师并设置状态为mentor_assigned]",
  })
  @ApiParam({
    name: "applicationId",
    required: true,
    description: "Application ID (UUID). [投递ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: PlacementReferralAssignMentorRequestDto })
  @ApiOkResponse({
    description: "Referral mentor assigned",
    type: JobApplicationResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async assignReferralMentor(
    @Param("applicationId") applicationId: string,
    @Body() body: PlacementReferralAssignMentorRequestDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobApplicationResponseDto> {
    const counselorId = String((user as unknown as { id: string }).id);
    const result = await this.assignReferralMentorCommand.execute({
      updateStatusDto: {
        applicationId,
        newStatus: "mentor_assigned",
        mentorId: body.mentorId,
        changedBy: counselorId,
        changeReason: "Assign referral mentor",
      },
    });

    return result.data as unknown as JobApplicationResponseDto;
  }
}


