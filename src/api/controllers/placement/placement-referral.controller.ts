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
import { CreateManualJobApplicationCommand } from "@application/commands/placement/create-manual-job-application.command";
import { PlacementReferralManualCreateRequestDto } from "@api/dto/request/placement-referral-manual-create.request.dto";
import { BatchJobApplicationsResponseDto, JobApplicationResponseDto } from "@api/dto/response/placement/placement.response.dto";
import type { IAssignReferralMentorDto } from "@api/dto/request/placement/placement.index";

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
    private readonly createManualJobApplicationCommand: CreateManualJobApplicationCommand,
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
    type: BatchJobApplicationsResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async batchRecommendReferralApplications(
    @Body() body: PlacementReferralBatchRecommendRequestDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<BatchJobApplicationsResponseDto> {
    // Use provided recommendedBy if available, otherwise default to JWT user ID
    // [如果提供了recommendedBy则使用，否则默认使用JWT中的用户ID]
    const recommendedBy = body.recommendedBy || String((user as unknown as { id: string }).id);
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

    // Assemble DTO for mentor assignment (组装导师分配DTO)
    const assignMentorDto: IAssignReferralMentorDto = {
      applicationId, // From URL parameter (来自URL参数)
      status: "mentor_assigned", // Target status (目标状态)
      mentorId: body.mentorId, // From request body (来自请求体)
    };

    const result = await this.assignReferralMentorCommand.execute(
      assignMentorDto,
      counselorId, // changedBy from JWT (从JWT提取changedBy)
    );

    return result.data as unknown as JobApplicationResponseDto;
  }

  /**
   * Create manual referral application [手工创建内推投递记录]
   * - Counselor manually creates job applications with mentor assigned status [顾问手工创建内推投递记录，状态默认设置为mentor_assigned]
   */
  @Post("referrals/manual")
  @ApiOperation({
    summary: "Create manual referral application",
    description:
      "Counselor manually creates job applications with mentor assigned status. [顾问手工创建内推投递记录，状态默认设置为mentor_assigned]",
  })
  @ApiBody({ type: PlacementReferralManualCreateRequestDto })
  @ApiCreatedResponse({
    description: "Manual referral application created",
    type: JobApplicationResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createManualReferral(
    @Body() body: PlacementReferralManualCreateRequestDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobApplicationResponseDto> {
    const counselorId = String((user as unknown as { id: string }).id);
    const result = await this.createManualJobApplicationCommand.execute({
      dto: {
        studentId: body.studentId,
        mentorId: body.mentorId,
        jobType: body.jobType ? [body.jobType] : [], // Convert string to string[] [将字符串转换为字符串数组]
        resumeSubmittedDate: body.resumeSubmittedDate,
        jobTitle: body.jobTitle,
        jobLink: body.jobLink,
        jobId: body.jobId,
        companyName: body.companyName,
        location: body.location,
        jobCategories: body.jobCategories,
        normalJobTitle: body.normalJobTitle ? [body.normalJobTitle] : [], // Convert string to string[] [将字符串转换为字符串数组]
        level: body.level,
        createdBy: counselorId,
      },
    });

    return result.data as unknown as JobApplicationResponseDto;
  }
}


