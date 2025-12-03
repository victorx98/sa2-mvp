import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { IJwtUser } from '@shared/types/jwt-user.interface';
import { CreateMentorAppealCommand } from '@application/commands/financial/create-mentor-appeal.command';
import { ApproveMentorAppealCommand } from '@application/commands/financial/approve-mentor-appeal.command';
import { RejectMentorAppealCommand } from '@application/commands/financial/reject-mentor-appeal.command';
import { GetMentorAppealsQuery } from '@application/queries/financial/get-mentor-appeals.query';
import { GetMentorAppealQuery } from '@application/queries/financial/get-mentor-appeal.query';
import { GetSettlementsQuery } from '@application/queries/financial/get-settlements.query';
import { GetSettlementQuery } from '@application/queries/financial/get-settlement.query';
import { CreateAppealDto } from '@domains/financial/dto/appeals/create-appeal.dto';
import { RejectAppealDto } from '@domains/financial/dto/appeals/reject-appeal.dto';
import { AppealSearchDto } from '@domains/financial/dto/appeals/appeal-search.dto';
import { IPaginationQuery, ISortQuery } from '@shared/types/pagination.types';
import { ISettlementQuery } from '@domains/financial/dto/settlement';

/**
 * Admin Financial Controller
 * [管理员财务控制器]
 * 
 * 提供财务相关的API端点，包括：
 * 1. 导师申诉管理
 * 2. 导师支付信息管理
 * 3. 导师支付参数管理
 * 4. 导师应付管理
 * 5. 结算管理
 */
@Controller('api/admin/financial')
@ApiTags('Admin Financial')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminFinancialController {
  constructor(
    // 导师申诉相关
    private readonly createMentorAppealCommand: CreateMentorAppealCommand,
    private readonly approveMentorAppealCommand: ApproveMentorAppealCommand,
    private readonly rejectMentorAppealCommand: RejectMentorAppealCommand,
    private readonly getMentorAppealsQuery: GetMentorAppealsQuery,
    private readonly getMentorAppealQuery: GetMentorAppealQuery,
    
    // 结算相关
    private readonly getSettlementsQuery: GetSettlementsQuery,
    private readonly getSettlementQuery: GetSettlementQuery,
  ) {}

  // ----------------------
  // 导师申诉管理
  // ----------------------

  @Post('mentor-appeals')
  @ApiOperation({ summary: 'Create a new mentor appeal' })
  @ApiResponse({ status: 201, description: 'Mentor appeal created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createMentorAppeal(
    @CurrentUser() user: IJwtUser,
    @Body() createMentorAppealDto: CreateAppealDto
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    return this.createMentorAppealCommand.execute({ 
      ...createMentorAppealDto, 
      createdBy: String((user as unknown as { id: string }).id) 
    });
  }

  @Get('mentor-appeals')
  @ApiOperation({ summary: 'Get all mentor appeals' })
  @ApiResponse({ status: 200, description: 'Mentor appeals retrieved successfully' })
  async getMentorAppeals(@Query() query: any) {
    return this.getMentorAppealsQuery.execute({
      filter: query as AppealSearchDto,
      pagination: {
        page: query.page,
        pageSize: query.pageSize
      } as IPaginationQuery,
      sort: {
        field: query.field,
        direction: query.order
      } as ISortQuery
    });
  }

  @Get('mentor-appeals/:id')
  @ApiOperation({ summary: 'Get mentor appeal by ID' })
  @ApiResponse({ status: 200, description: 'Mentor appeal retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Mentor appeal not found' })
  async getMentorAppealById(@Param('id') id: string) {
    return this.getMentorAppealQuery.execute({ id });
  }

  @Patch('mentor-appeals/:id/approve')
  @ApiOperation({ summary: 'Approve mentor appeal' })
  @ApiResponse({ status: 200, description: 'Mentor appeal approved successfully' })
  @ApiResponse({ status: 404, description: 'Mentor appeal not found' })
  async approveMentorAppeal(
    @CurrentUser() user: IJwtUser,
    @Param('id') id: string
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    return this.approveMentorAppealCommand.execute({ 
      id, 
      approvedBy: String((user as unknown as { id: string }).id) 
    });
  }

  @Patch('mentor-appeals/:id/reject')
  @ApiOperation({ summary: 'Reject mentor appeal' })
  @ApiResponse({ status: 200, description: 'Mentor appeal rejected successfully' })
  @ApiResponse({ status: 404, description: 'Mentor appeal not found' })
  async rejectMentorAppeal(
    @CurrentUser() user: IJwtUser,
    @Param('id') id: string,
    @Body() rejectAppealDto: RejectAppealDto
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    return this.rejectMentorAppealCommand.execute({ 
      id, 
      rejectedBy: String((user as unknown as { id: string }).id),
      rejectReason: rejectAppealDto.rejectionReason 
    });
  }

  // ----------------------
  // 结算管理
  // ----------------------

  @Get('settlements')
  @ApiOperation({ summary: 'Get all settlements' })
  @ApiResponse({ status: 200, description: 'Settlements retrieved successfully' })
  async getSettlements(
    @Query() query: ISettlementQuery
  ) {
    return this.getSettlementsQuery.execute({ query });
  }

  @Get('settlements/:id')
  @ApiOperation({ summary: 'Get settlement by ID' })
  @ApiResponse({ status: 200, description: 'Settlement retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Settlement not found' })
  async getSettlementById(@Param('id') id: string) {
    return this.getSettlementQuery.execute({ id });
  }


}
