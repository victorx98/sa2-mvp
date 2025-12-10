import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard as AuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { UseGuards } from "@nestjs/common";
import { CreateJobPositionCommand } from "@application/commands/placement/create-job-position.command";
import { UpdateJobPositionCommand } from "@application/commands/placement/update-job-position.command";
import { UpdateJobApplicationStatusCommand } from "@application/commands/placement/update-job-application-status.command";
import { RollbackJobApplicationStatusCommand } from "@application/commands/placement/rollback-job-application-status.command";
import {
  ICreateJobPositionDto,
  IUpdateApplicationStatusDto,
  IRollbackApplicationStatusDto,
} from "@domains/placement/dto";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import type { IJwtUser } from "@shared/types/jwt-user.interface";

/**
 * Admin Placement Controller
 * [管理员配置控制器]
 *
 * 提供配置相关的API端点，包括：
 * 1. 职位管理
 * 2. 职位申请管理
 */
@Controller("api/admin/placement")
@ApiTags("Admin Placement")
@UseGuards(AuthGuard, RolesGuard)
@Roles("admin", "manager")
export class AdminPlacementController {
  constructor(
    // 职位管理相关
    private readonly createJobPositionCommand: CreateJobPositionCommand,
    private readonly updateJobPositionCommand: UpdateJobPositionCommand,

    // 职位申请管理相关
    private readonly updateJobApplicationStatusCommand: UpdateJobApplicationStatusCommand,
    private readonly rollbackJobApplicationStatusCommand: RollbackJobApplicationStatusCommand,
  ) {}

  // ----------------------
  // 职位管理
  // ----------------------

  @Post("job-positions")
  @ApiOperation({ summary: "Create a new job position" })
  @ApiResponse({
    status: 201,
    description: "Job position created successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createJobPosition(
    @Body() createJobPositionDto: ICreateJobPositionDto,
    @CurrentUser() user: IJwtUser,
  ) {
    // Use command pattern to create job position [使用命令模式创建职位]
    const result = await this.createJobPositionCommand.execute({
      createJobPositionDto: {
        ...createJobPositionDto,
        createdBy: String((user as unknown as { id: string }).id),
      },
    });
    // IServiceResult structure: { data: T, event?: {...}, events?: [...] } [IServiceResult结构]
    return result.data;
  }

  @Patch("job-positions/:id/expire")
  @ApiOperation({ summary: "Mark job position as expired" })
  @ApiResponse({
    status: 200,
    description: "Job position marked as expired successfully",
  })
  @ApiResponse({ status: 404, description: "Job position not found" })
  async markJobPositionExpired(
    @Param("id") id: string,
    @Body() markExpiredDto: { reason?: string },
    @CurrentUser() user: IJwtUser,
  ) {
    // Use command pattern to mark job position as expired [使用命令模式标记职位过期]
    const result = await this.updateJobPositionCommand.execute({
      jobId: id,
      expiredBy: String((user as unknown as { id: string }).id),
      expiredByType: "bd" as const, // Admin users are treated as BD (business development) for job expiration tracking [管理员用户在职位过期跟踪中被视为BD]
      reason: markExpiredDto.reason,
    });
    // IServiceResult structure: { data: T, event?: {...}, events?: [...] } [IServiceResult结构]
    return result.data;
  }



  // ----------------------
  // 职位申请管理
  // ----------------------

  @Patch("job-applications/:id/status")
  @ApiOperation({ summary: "Update job application status" })
  @ApiResponse({
    status: 200,
    description: "Job application status updated successfully",
  })
  @ApiResponse({ status: 404, description: "Job application not found" })
  async updateJobApplicationStatus(
    @Body() updateStatusDto: IUpdateApplicationStatusDto,
  ) {
    return this.updateJobApplicationStatusCommand.execute({
      updateStatusDto,
    });
  }



  @Patch("job-applications/:id/rollback")
  @ApiOperation({ summary: "Rollback job application status" })
  @ApiResponse({
    status: 200,
    description: "Job application status rolled back successfully",
  })
  @ApiResponse({ status: 404, description: "Job application not found" })
  @ApiResponse({ status: 400, description: "Bad request - insufficient history or invalid transition" })
  async rollbackJobApplicationStatus(
    @Param("id") id: string,
    @Body() rollbackDto: Omit<IRollbackApplicationStatusDto, "applicationId">,
    @CurrentUser() user: IJwtUser,
  ) {
    return this.rollbackJobApplicationStatusCommand.execute({
      rollbackDto: {
        ...rollbackDto,
        applicationId: id,
        changedBy: rollbackDto.changedBy || String((user as unknown as { id: string }).id),
      },
    });
  }
}
