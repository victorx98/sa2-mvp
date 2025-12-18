import {
  Controller,
  Post,
  Body,
  Param,
  Patch,
  BadRequestException,
  UseGuards,
} from "@nestjs/common";
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
import { CreateJobPositionCommand } from "@application/commands/placement/create-job-position.command";
import { UpdateJobPositionCommand } from "@application/commands/placement/update-job-position.command";
import { UpdateJobApplicationStatusCommand } from "@application/commands/placement/update-job-application-status.command";
import { RollbackJobApplicationStatusCommand } from "@application/commands/placement/rollback-job-application-status.command";
import type { ICreateJobPositionDto, IRollbackApplicationStatusDto, IUpdateApplicationStatusDto } from "@domains/placement/dto";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import type { IJwtUser } from "@shared/types/jwt-user.interface";
import { PlacementJobApplicationUpdateStatusRequestDto } from "@api/dto/request/placement-job-application-update-status.request.dto";
import { CreateJobPositionRequestDto, RollbackJobApplicationStatusRequestDto } from "@api/dto/request/placement/job-position.request.dto";
import { JobApplicationResponseDto, JobApplicationServiceResultResponseDto, JobPositionResponseDto } from "@api/dto/response/placement/placement.response.dto";

/**
 * Admin Placement Controller
 * [管理员配置控制器]
 *
 * 提供配置相关的API端点，包括：
 * 1. 职位管理
 * 2. 职位申请管理
 */
@Controller("api/placement")
@ApiTags("Placement")
@UseGuards(AuthGuard, RolesGuard)
@Roles("admin", "manager")
@ApiBearerAuth()
export class PlacementController {
  constructor(
    // 职位管理相关
    private readonly createJobPositionCommand: CreateJobPositionCommand,
    private readonly updateJobPositionCommand: UpdateJobPositionCommand,

    // 职位申请管理相关
    private readonly updateJobApplicationStatusCommand: UpdateJobApplicationStatusCommand,
    private readonly rollbackJobApplicationStatusCommand: RollbackJobApplicationStatusCommand,
  ) { }

  // ----------------------
  // 职位管理
  // ----------------------

  @Post("job-positions")
  @ApiOperation({
    summary: "Create a new job position",
    description:
      "Creates a job position in recommended_jobs. createdBy is set from current user. [创建推荐岗位记录，createdBy 由当前用户注入]",
  })
  @ApiBody({ type: CreateJobPositionRequestDto })
  @ApiCreatedResponse({
    description: "Job position created successfully",
    type: JobPositionResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createJobPosition(
    @Body() body: CreateJobPositionRequestDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobPositionResponseDto> {
    // Use command pattern to create job position [使用命令模式创建职位]
    const createJobPositionDto: ICreateJobPositionDto =
      body as unknown as ICreateJobPositionDto;
    const result = await this.createJobPositionCommand.execute({
      createJobPositionDto: {
        ...createJobPositionDto,
        createdBy: String((user as unknown as { id: string }).id),
      },
    });
    // IServiceResult structure: { data: T, event?: {...}, events?: [...] } [IServiceResult结构]
    const jobData = result.data as unknown as {
      id: string;
      postDate: Date | string | null;
      createdAt: Date | string;
      updatedAt: Date | string;
      [key: string]: unknown;
    };
    return {
      ...jobData,
      postDate: jobData.postDate ? (jobData.postDate instanceof Date ? jobData.postDate.toISOString() : jobData.postDate) : null,
      createdAt: jobData.createdAt instanceof Date ? jobData.createdAt.toISOString() : jobData.createdAt,
      updatedAt: jobData.updatedAt instanceof Date ? jobData.updatedAt.toISOString() : jobData.updatedAt,
    } as JobPositionResponseDto;
  }

  @Patch("job-positions/:id/expire")
  @ApiOperation({
    summary: "Mark job position as expired",
    description:
      "Marks a job position as expired. [标记岗位为expired]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Job ID (UUID). [岗位ID(UUID)]",
    type: String,
  })
  @ApiOkResponse({
    description: "Job position marked as expired successfully",
    type: JobPositionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Job position not found" })
  async markJobPositionExpired(
    @Param("id") id: string,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobPositionResponseDto> {
    // Use command pattern to mark job position as expired [使用命令模式标记职位过期]
    const result = await this.updateJobPositionCommand.execute({
      jobId: id,
      expiredBy: String((user as unknown as { id: string }).id),
      expiredByType: "bd" as const, // Admin users are treated as BD (business development) for job expiration tracking [管理员用户在职位过期跟踪中被视为BD]
    });
    // IServiceResult structure: { data: T, event?: {...}, events?: [...] } [IServiceResult结构]
    const jobData = result.data as unknown as {
      id: string;
      postDate: Date | string | null;
      createdAt: Date | string;
      updatedAt: Date | string;
      [key: string]: unknown;
    };
    return {
      ...jobData,
      postDate: jobData.postDate ? (jobData.postDate instanceof Date ? jobData.postDate.toISOString() : jobData.postDate) : null,
      createdAt: jobData.createdAt instanceof Date ? jobData.createdAt.toISOString() : jobData.createdAt,
      updatedAt: jobData.updatedAt instanceof Date ? jobData.updatedAt.toISOString() : jobData.updatedAt,
    } as JobPositionResponseDto;
  }



  // ----------------------
  // 职位申请管理
  // ----------------------

  @Patch("job-applications/:id/status")
  @Roles("admin", "manager", "counselor")
  @ApiOperation({
    summary: "Update job application status",
    description:
      "Updates application status. Counselor role is restricted to 'revoked' only. [更新投递状态；顾问角色仅允许revoked]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Application ID (UUID). [投递ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: PlacementJobApplicationUpdateStatusRequestDto })
  @ApiOkResponse({
    description: "Job application status updated successfully",
    type: JobApplicationServiceResultResponseDto,
  })
  @ApiResponse({ status: 404, description: "Job application not found" })
  async updateJobApplicationStatus(
    @Param("id") applicationId: string,
    @Body() body: PlacementJobApplicationUpdateStatusRequestDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobApplicationServiceResultResponseDto> {
    // Restrict counselor to revoked only [限制顾问只能设置revoked]
    const userRoles: string[] = Array.isArray((user as unknown as { roles?: string[] }).roles)
      ? (user as unknown as { roles: string[] }).roles
      : [];
    const isCounselor = userRoles.includes("counselor");
    if (isCounselor && body.status !== "revoked") {
      throw new BadRequestException(
        "Counselor can only revoke recommended/interested applications",
      );
    }

    // Block mentor assignment here to force using counselor-facing endpoint [禁止在旧接口分配导师，强制使用顾问专用接口]
    if (body.status === "mentor_assigned") {
      throw new BadRequestException(
        "Use PATCH /api/placement/referrals/:applicationId/mentor for mentor assignment",
      );
    }

    const mappedDto: IUpdateApplicationStatusDto = {
      applicationId,
      newStatus: body.status,
      changedBy: String((user as unknown as { id: string }).id),
    };

    const serviceResult = await this.updateJobApplicationStatusCommand.execute({
      updateStatusDto: mappedDto,
    });
    return {
      ...serviceResult,
      data: serviceResult.data as unknown as JobApplicationResponseDto,
    };
  }



  @Patch("job-applications/:id/rollback")
  @ApiOperation({
    summary: "Rollback job application status",
    description:
      "Rolls back application status to previous state. [将投递状态回撤到上一个状态]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Application ID (UUID). [投递ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: RollbackJobApplicationStatusRequestDto })
  @ApiOkResponse({
    description: "Job application status rolled back successfully",
    type: JobApplicationResponseDto,
  })
  @ApiResponse({ status: 404, description: "Job application not found" })
  @ApiResponse({ status: 400, description: "Bad request - insufficient history or invalid transition" })
  async rollbackJobApplicationStatus(
    @Param("id") id: string,
    @Body() rollbackDto: RollbackJobApplicationStatusRequestDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<JobApplicationResponseDto> {
    const dto: Omit<IRollbackApplicationStatusDto, "applicationId"> =
      rollbackDto as unknown as Omit<IRollbackApplicationStatusDto, "applicationId">;
    const result = await this.rollbackJobApplicationStatusCommand.execute({
      rollbackDto: {
        ...dto,
        applicationId: id,
        changedBy:
          dto.changedBy || String((user as unknown as { id: string }).id),
      },
    });
    return result as unknown as JobApplicationResponseDto;
  }
}
