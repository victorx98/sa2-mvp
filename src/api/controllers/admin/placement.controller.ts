import { Controller, Get, Post, Body, Param, Patch, Delete, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard as AuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { CreateJobPositionCommand } from '@application/commands/placement/create-job-position.command';
import { UpdateJobPositionCommand } from '@application/commands/placement/update-job-position.command';
import { UpdateJobApplicationStatusCommand } from '@application/commands/placement/update-job-application-status.command';
import { GetJobPositionsQuery } from '@application/queries/placement/get-job-positions.query';
import { GetJobPositionQuery } from '@application/queries/placement/get-job-position.query';
import { GetJobApplicationsQuery } from '@application/queries/placement/get-job-applications.query';
import { GetJobApplicationQuery } from '@application/queries/placement/get-job-application.query';
import { ICreateJobPositionDto, ISubmitApplicationDto, IUpdateApplicationStatusDto } from '@domains/placement/dto';
import { IPaginationQuery, ISortQuery } from '@shared/types/pagination.types';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import type { IJwtUser } from '@shared/types/jwt-user.interface';

/**
 * Admin Placement Controller
 * [管理员配置控制器]
 * 
 * 提供配置相关的API端点，包括：
 * 1. 配置规则管理
 * 2. 服务匹配管理
 * 3. 资源分配管理
 * 4. 职位管理
 * 5. 职位申请管理
 */
@Controller('api/admin/placement')
@ApiTags('Admin Placement')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager')
export class AdminPlacementController {
  constructor(
    // 职位管理相关
    private readonly createJobPositionCommand: CreateJobPositionCommand,
    private readonly updateJobPositionCommand: UpdateJobPositionCommand,
    private readonly getJobPositionsQuery: GetJobPositionsQuery,
    private readonly getJobPositionQuery: GetJobPositionQuery,
    
    // 职位申请管理相关
    private readonly updateJobApplicationStatusCommand: UpdateJobApplicationStatusCommand,
    private readonly getJobApplicationsQuery: GetJobApplicationsQuery,
    private readonly getJobApplicationQuery: GetJobApplicationQuery,
  ) {}

  // ----------------------
  // 职位管理
  // ----------------------

  @Post('job-positions')
  @ApiOperation({ summary: 'Create a new job position' })
  @ApiResponse({ status: 201, description: 'Job position created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
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

  @Get('job-positions')
  @ApiOperation({ summary: 'Get all job positions' })
  @ApiResponse({ status: 200, description: 'Job positions retrieved successfully' })
  async getJobPositions(
    @Query() pagination?: IPaginationQuery,
    @Query() sort?: ISortQuery
  ) {
    return this.getJobPositionsQuery.execute({ pagination, sort });
  }

  @Get('job-positions/:id')
  @ApiOperation({ summary: 'Get job position by ID' })
  @ApiResponse({ status: 200, description: 'Job position retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job position not found' })
  async getJobPositionById(@Param('id') id: string) {
    return this.getJobPositionQuery.execute({ id });
  }

  @Patch('job-positions/:id/expire')
  @ApiOperation({ summary: 'Mark job position as expired' })
  @ApiResponse({ status: 200, description: 'Job position marked as expired successfully' })
  @ApiResponse({ status: 404, description: 'Job position not found' })
  async markJobPositionExpired(
    @Param('id') id: string,
    @Body() markExpiredDto: { reason?: string },
    @CurrentUser() user: IJwtUser,
  ) {
    // Use command pattern to mark job position as expired [使用命令模式标记职位过期]
    const result = await this.updateJobPositionCommand.execute({
      jobId: id,
      expiredBy: String((user as unknown as { id: string }).id),
      expiredByType: 'bd' as const, // Admin users are treated as BD (business development) for job expiration tracking [管理员用户在职位过期跟踪中被视为BD]
      reason: markExpiredDto.reason,
    });
    // IServiceResult structure: { data: T, event?: {...}, events?: [...] } [IServiceResult结构]
    return result.data;
  }

  // ----------------------
  // 职位申请管理
  // ----------------------

  @Get('job-applications')
  @ApiOperation({ summary: 'Get all job applications' })
  @ApiResponse({ status: 200, description: 'Job applications retrieved successfully' })
  async getJobApplications(
    @Query() pagination?: IPaginationQuery,
    @Query() sort?: ISortQuery
  ) {
    return this.getJobApplicationsQuery.execute({ pagination, sort });
  }

  @Get('job-applications/:id')
  @ApiOperation({ summary: 'Get job application by ID' })
  @ApiResponse({ status: 200, description: 'Job application retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job application not found' })
  async getJobApplicationById(@Param('id') id: string) {
    return this.getJobApplicationQuery.execute({ id });
  }

  @Patch('job-applications/:id/status')
  @ApiOperation({ summary: 'Update job application status' })
  @ApiResponse({ status: 200, description: 'Job application status updated successfully' })
  @ApiResponse({ status: 404, description: 'Job application not found' })
  async updateJobApplicationStatus(
    @Body() updateStatusDto: IUpdateApplicationStatusDto
  ) {
    return this.updateJobApplicationStatusCommand.execute({ 
      updateStatusDto 
    });
  }

  // ----------------------
  // 配置规则管理
  // ----------------------

  @Post('rules')
  @ApiOperation({ summary: 'Create a new configuration rule' })
  @ApiResponse({ status: 201, description: 'Configuration rule created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 501, description: 'Not implemented' })
  async createConfigurationRule() {
    throw new HttpException(
      'Configuration rule creation is not yet implemented',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get all configuration rules' })
  @ApiResponse({ status: 200, description: 'Configuration rules retrieved successfully' })
  @ApiResponse({ status: 501, description: 'Not implemented' })
  async getConfigurationRules() {
    throw new HttpException(
      'Configuration rules retrieval is not yet implemented',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get configuration rule by ID' })
  @ApiResponse({ status: 200, description: 'Configuration rule retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Configuration rule not found' })
  @ApiResponse({ status: 501, description: 'Not implemented' })
  async getConfigurationRuleById() {
    throw new HttpException(
      'Configuration rule retrieval by ID is not yet implemented',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update configuration rule' })
  @ApiResponse({ status: 200, description: 'Configuration rule updated successfully' })
  @ApiResponse({ status: 404, description: 'Configuration rule not found' })
  @ApiResponse({ status: 501, description: 'Not implemented' })
  async updateConfigurationRule() {
    throw new HttpException(
      'Configuration rule update is not yet implemented',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Delete configuration rule' })
  @ApiResponse({ status: 204, description: 'Configuration rule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Configuration rule not found' })
  @ApiResponse({ status: 501, description: 'Not implemented' })
  async deleteConfigurationRule() {
    throw new HttpException(
      'Configuration rule deletion is not yet implemented',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  // ----------------------
  // 职位申请历史管理
  // ----------------------

  @Get('job-applications/:id/history')
  @ApiOperation({ summary: 'Get job application status history' })
  @ApiResponse({ status: 200, description: 'Job application status history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job application not found' })
  @ApiResponse({ status: 501, description: 'Not implemented' })
  async getJobApplicationHistory() {
    throw new HttpException(
      'Job application history retrieval is not yet implemented',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  @Patch('job-applications/:id/rollback')
  @ApiOperation({ summary: 'Rollback job application status' })
  @ApiResponse({ status: 200, description: 'Job application status rolled back successfully' })
  @ApiResponse({ status: 404, description: 'Job application not found' })
  @ApiResponse({ status: 501, description: 'Not implemented' })
  async rollbackJobApplicationStatus() {
    throw new HttpException(
      'Job application status rollback is not yet implemented',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}
