import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard as AuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import type { IJwtUser } from "@shared/types/jwt-user.interface";
import { RecommendReferralApplicationsBatchCommand } from "@application/commands/placement/recommend-referral-applications-batch.command";
import { PlacementReferralBatchRecommendRequestDto } from "@api/dto/request/placement-referral-batch.request.dto";

/**
 * Placement Referral Controller [内推推荐控制器]
 * - Counselor recommends jobs to students by creating referral applications [顾问给学生推荐岗位，创建内推投递记录]
 */
@Controller("api/placement")
@ApiTags("Placement Referral")
@UseGuards(AuthGuard, RolesGuard)
@Roles("counselor")
export class PlacementReferralController {
  constructor(
    private readonly recommendReferralApplicationsBatchCommand: RecommendReferralApplicationsBatchCommand,
  ) {}

  @Post("referrals/recommendations/batch")
  @ApiOperation({ summary: "Batch recommend referral applications" })
  @ApiResponse({ status: 201, description: "Referral applications recommended" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async batchRecommendReferralApplications(
    @Body() body: PlacementReferralBatchRecommendRequestDto,
    @CurrentUser() user: IJwtUser,
  ) {
    const recommendedBy = String((user as unknown as { id: string }).id);
    const result = await this.recommendReferralApplicationsBatchCommand.execute({
      dto: {
        recommendedBy,
        studentIds: body.studentIds,
        jobIds: body.jobIds,
      },
    });
    return result.data;
  }
}


