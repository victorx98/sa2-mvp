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
import { GetJobPositionsQuery } from "@application/queries/placement/get-job-positions.query";
import { GetJobPositionQuery } from "@application/queries/placement/get-job-position.query";
import { GetJobApplicationsQuery } from "@application/queries/placement/get-job-applications.query";
import { GetJobApplicationQuery } from "@application/queries/placement/get-job-application.query";
import { GetJobApplicationHistoryQuery } from "@application/queries/placement/get-job-application-history.query";
import { RollbackJobApplicationStatusCommand } from "@application/commands/placement/rollback-job-application-status.command";
import {
  ICreateJobPositionDto,
  IUpdateApplicationStatusDto,
  IRollbackApplicationStatusDto,
} from "@domains/placement/dto";
import { IPaginationQuery, ISortQuery } from "@shared/types/pagination.types";
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
    private readonly getJobPositionsQuery: GetJobPositionsQuery,
    private readonly getJobPositionQuery: GetJobPositionQuery,

    // 职位申请管理相关
    private readonly updateJobApplicationStatusCommand: UpdateJobApplicationStatusCommand,
    private readonly rollbackJobApplicationStatusCommand: RollbackJobApplicationStatusCommand,
    private readonly getJobApplicationsQuery: GetJobApplicationsQuery,
    private readonly getJobApplicationQuery: GetJobApplicationQuery,
    private readonly getJobApplicationHistoryQuery: GetJobApplicationHistoryQuery,
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

  @Get("job-positions/:id")
  @ApiOperation({ summary: "Get job position by ID" })
  @ApiResponse({
    status: 200,
    description: "Job position retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Job position not found" })
  async getJobPositionById(@Param("id") id: string) {
    return this.getJobPositionQuery.execute({ id });
  }

  @Get("job-positions")
  @ApiOperation({ summary: "Get all job positions" })
  @ApiResponse({
    status: 200,
    description: "Job positions retrieved successfully",
  })
  async getJobPositions(@Query() query: any) {
    // Extract pagination and sort parameters [提取分页和排序参数]
    // Validate and provide defaults for pagination [验证分页参数并提供默认值]
    const page =
      query.page !== undefined &&
      query.page !== null &&
      !isNaN(Number(query.page))
        ? Number(query.page)
        : 1;
    const pageSize =
      query.pageSize !== undefined &&
      query.pageSize !== null &&
      !isNaN(Number(query.pageSize))
        ? Number(query.pageSize)
        : 10;

    if (page < 1 || pageSize < 1) {
      throw new HttpException(
        "Invalid pagination parameters. Page and pageSize must be positive integers.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const pagination: IPaginationQuery = {
      page,
      pageSize,
    };
    const sort: ISortQuery | undefined = query.field !== undefined || query.direction !== undefined
      ? {
          field: query.field || "createdAt",
          direction: (query.direction || query.order || "desc") as "asc" | "desc",
        }
      : undefined;
    return this.getJobPositionsQuery.execute({ pagination, sort });
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

  @Get("job-applications/:id")
  @ApiOperation({ summary: "Get job application by ID" })
  @ApiResponse({
    status: 200,
    description: "Job application retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Job application not found" })
  async getJobApplicationById(@Param("id") id: string) {
    return this.getJobApplicationQuery.execute({ id });
  }

  @Get("job-applications")
  @ApiOperation({ summary: "Get all job applications" })
  @ApiResponse({
    status: 200,
    description: "Job applications retrieved successfully",
  })
  async getJobApplications(@Query() query: any) {
    // Extract pagination and sort parameters [提取分页和排序参数]
    // Validate and provide defaults for pagination [验证分页参数并提供默认值]
    const page =
      query.page !== undefined &&
      query.page !== null &&
      !isNaN(Number(query.page))
        ? Number(query.page)
        : 1;
    const pageSize =
      query.pageSize !== undefined &&
      query.pageSize !== null &&
      !isNaN(Number(query.pageSize))
        ? Number(query.pageSize)
        : 10;

    if (page < 1 || pageSize < 1) {
      throw new HttpException(
        "Invalid pagination parameters. Page and pageSize must be positive integers.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const pagination: IPaginationQuery = {
      page,
      pageSize,
    };
    const sort: ISortQuery | undefined = query.field !== undefined || query.direction !== undefined
      ? {
          field: query.field || "createdAt",
          direction: (query.direction || query.order || "desc") as "asc" | "desc",
        }
      : undefined;
    return this.getJobApplicationsQuery.execute({ pagination, sort });
  }

  // ----------------------
  // 职位申请历史管理
  // ----------------------

  @Get("job-applications/:id/history")
  @ApiOperation({ summary: "Get job application status history" })
  @ApiResponse({
    status: 200,
    description: "Job application status history retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Job application not found" })
  async getJobApplicationHistory(@Param("id") id: string) {
    return this.getJobApplicationHistoryQuery.execute({ applicationId: id });
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
