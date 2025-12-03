import { Controller, Get, Post, Body, Param, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { IJwtUser } from '@shared/types/jwt-user.interface';
import { CreateJobPositionCommand } from '@application/commands/placement/create-job-position.command';
import { UpdateJobPositionCommand } from '@application/commands/placement/update-job-position.command';
import { UpdateJobApplicationStatusCommand } from '@application/commands/placement/update-job-application-status.command';
import { GetJobPositionsQuery } from '@application/queries/placement/get-job-positions.query';
import { GetJobPositionQuery } from '@application/queries/placement/get-job-position.query';
import { GetJobApplicationsQuery } from '@application/queries/placement/get-job-applications.query';
import { GetJobApplicationQuery } from '@application/queries/placement/get-job-application.query';
import { ISubmitApplicationDto, IUpdateApplicationStatusDto } from '@domains/placement/dto';
import { IPaginationQuery, ISortQuery } from '@shared/types/pagination.types';

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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
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
    @Body() createJobApplicationDto: ISubmitApplicationDto
  ) {
    return this.createJobPositionCommand.execute({ 
      jobApplication: createJobApplicationDto 
    });
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

  @Patch('job-positions/:id')
  @ApiOperation({ summary: 'Update job position' })
  @ApiResponse({ status: 200, description: 'Job position updated successfully' })
  @ApiResponse({ status: 404, description: 'Job position not found' })
  async updateJobPosition(
    @Param('id') id: string,
    @Body() updateStatusDto: IUpdateApplicationStatusDto
  ) {
    return this.updateJobPositionCommand.execute({ 
      id, 
      updateStatusDto 
    });
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
  async createConfigurationRule(
    @CurrentUser() _user: IJwtUser,
    @Body() _createRuleDto: unknown // 后续替换为实际的DTO
  ) {
    // 后续实现CreateConfigurationRuleCommand
    return { data: null };
  }

  @Get('rules')
  @ApiOperation({ summary: 'Get all configuration rules' })
  @ApiResponse({ status: 200, description: 'Configuration rules retrieved successfully' })
  async getConfigurationRules(
    @Query() _pagination?: IPaginationQuery,
    @Query() _sort?: ISortQuery
  ) {
    // 后续实现GetConfigurationRulesQuery
    return { data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } };
  }

  @Get('rules/:id')
  @ApiOperation({ summary: 'Get configuration rule by ID' })
  @ApiResponse({ status: 200, description: 'Configuration rule retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Configuration rule not found' })
  async getConfigurationRuleById(@Param('id') _id: string) {
    // 后续实现GetConfigurationRuleQuery
    return { data: null };
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Update configuration rule' })
  @ApiResponse({ status: 200, description: 'Configuration rule updated successfully' })
  @ApiResponse({ status: 404, description: 'Configuration rule not found' })
  async updateConfigurationRule(
    @Param('id') _id: string,
    @Body() _updateRuleDto: unknown // 后续替换为实际的DTO
  ) {
    // 后续实现UpdateConfigurationRuleCommand
    return { data: null };
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Delete configuration rule' })
  @ApiResponse({ status: 204, description: 'Configuration rule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Configuration rule not found' })
  async deleteConfigurationRule(@Param('id') _id: string) {
    // 后续实现DeleteConfigurationRuleCommand
    return { data: null };
  }

  // ----------------------
  // 职位申请历史管理
  // ----------------------

  @Get('job-applications/:id/history')
  @ApiOperation({ summary: 'Get job application status history' })
  @ApiResponse({ status: 200, description: 'Job application status history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Job application not found' })
  async getJobApplicationHistory(@Param('id') _id: string) {
    // 后续实现GetJobApplicationHistoryQuery
    return { data: null };
  }

  @Patch('job-applications/:id/rollback')
  @ApiOperation({ summary: 'Rollback job application status' })
  @ApiResponse({ status: 200, description: 'Job application status rolled back successfully' })
  @ApiResponse({ status: 404, description: 'Job application not found' })
  async rollbackJobApplicationStatus(
    @Param('id') _id: string,
    @Body() _rollbackDto: unknown // 后续替换为实际的DTO
  ) {
    // 后续实现RollbackJobApplicationStatusCommand
    return { data: null };
  }
}
