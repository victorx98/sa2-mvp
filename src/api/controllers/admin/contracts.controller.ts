import { Controller, Get, Post, Body, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard as AuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CreateContractCommand } from '@application/commands/contract/create-contract.command';
import { ActivateContractCommand } from '@application/commands/contract/activate-contract.command';
import { SignContractCommand } from '@application/commands/contract/sign-contract.command';
import { SuspendContractCommand } from '@application/commands/contract/suspend-contract.command';
import { ResumeContractCommand } from '@application/commands/contract/resume-contract.command';
import { CompleteContractCommand } from '@application/commands/contract/complete-contract.command';
import { TerminateContractCommand } from '@application/commands/contract/terminate-contract.command';
import { UpdateContractCommand } from '@application/commands/contract/update-contract.command';
import { ConsumeServiceCommand } from '@application/commands/contract/consume-service.command';
import { AddAmendmentLedgerCommand } from '@application/commands/contract/add-amendment-ledger.command';
import { GetContractQuery } from '@application/queries/contract/get-contract.query';
import { GetContractsQuery } from '@application/queries/contract/get-contracts.query';
import { CreateContractDto } from '@domains/contract/dto/create-contract.dto';
import { UpdateContractDto } from '@domains/contract/dto/update-contract.dto';
import { ConsumeServiceDto } from '@domains/contract/dto/consume-service.dto';
import { AddAmendmentLedgerDto } from '@domains/contract/dto/add-amendment-ledger.dto';
import { IPaginationQuery, ISortQuery } from '@shared/types/pagination.types';

/**
 * Admin Contracts Controller
 * [管理员合同控制器]
 * 
 * 职责：
 * 1. 处理合同相关的HTTP请求
 * 2. 执行认证和授权
 * 3. 调用Application Layer的Command和Query
 * 4. 返回HTTP响应
 */
@Controller('api/admin/contracts')
@ApiTags('Admin Contracts')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager', 'counselor')
export class AdminContractsController {
  constructor(
    private readonly createContractCommand: CreateContractCommand,
    private readonly activateContractCommand: ActivateContractCommand,
    private readonly signContractCommand: SignContractCommand,
    private readonly suspendContractCommand: SuspendContractCommand,
    private readonly resumeContractCommand: ResumeContractCommand,
    private readonly completeContractCommand: CompleteContractCommand,
    private readonly terminateContractCommand: TerminateContractCommand,
    private readonly updateContractCommand: UpdateContractCommand,
    private readonly consumeServiceCommand: ConsumeServiceCommand,
    private readonly addAmendmentLedgerCommand: AddAmendmentLedgerCommand,
    private readonly getContractQuery: GetContractQuery,
    private readonly getContractsQuery: GetContractsQuery,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new contract' })
  @ApiResponse({ status: 201, description: 'Contract created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async create(
    @CurrentUser() user: any,
    @Body() createContractDto: CreateContractDto,
  ) {
    return this.createContractCommand.execute({
      ...createContractDto,
      createdBy: String(user.id),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contract by ID' })
  @ApiResponse({ status: 200, description: 'Contract retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async findOne(@Param('id') id: string) {
    return this.getContractQuery.execute({ contractId: id });
  }

  @Get()
  @ApiOperation({ summary: 'Get all contracts' })
  @ApiResponse({ status: 200, description: 'Contracts retrieved successfully' })
  async findAll(
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('productId') productId?: string,
    @Query('signedAfter') signedAfter?: Date,
    @Query('signedBefore') signedBefore?: Date,
    @Query() pagination?: IPaginationQuery,
    @Query() sort?: ISortQuery
  ) {
    return this.getContractsQuery.execute(
      { studentId, status, productId, signedAfter, signedBefore },
      pagination,
      sort
    );
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate contract' })
  @ApiResponse({ status: 200, description: 'Contract activated successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async activate(@Param('id') id: string) {
    return this.activateContractCommand.execute(id);
  }

  @Post(':id/sign')
  @ApiOperation({ summary: 'Sign contract' })
  @ApiResponse({ status: 200, description: 'Contract signed successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async sign(@Param('id') id: string, @CurrentUser() user: any) {
    return this.signContractCommand.execute(id, String(user.id));
  }

  @Post(':id/suspend')
  @ApiOperation({ summary: 'Suspend contract' })
  @ApiResponse({ status: 200, description: 'Contract suspended successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async suspend(@Param('id') id: string, @Body('reason') reason: string) {
    return this.suspendContractCommand.execute(id, reason);
  }

  @Post(':id/resume')
  @ApiOperation({ summary: 'Resume contract' })
  @ApiResponse({ status: 200, description: 'Contract resumed successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async resume(@Param('id') id: string) {
    return this.resumeContractCommand.execute(id);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Complete contract' })
  @ApiResponse({ status: 200, description: 'Contract completed successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async complete(@Param('id') id: string) {
    return this.completeContractCommand.execute(id);
  }

  @Post(':id/terminate')
  @ApiOperation({ summary: 'Terminate contract' })
  @ApiResponse({ status: 200, description: 'Contract terminated successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async terminate(@Param('id') id: string, @Body('reason') reason: string) {
    return this.terminateContractCommand.execute(id, reason);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contract' })
  @ApiResponse({ status: 200, description: 'Contract updated successfully' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async update(@Param('id') id: string, @Body() updateContractDto: UpdateContractDto) {
    return this.updateContractCommand.execute(id, updateContractDto);
  }

  @Post('consume')
  @ApiOperation({ summary: 'Consume service' })
  @ApiResponse({ status: 200, description: 'Service consumed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async consumeService(@Body() consumeServiceDto: ConsumeServiceDto) {
    return this.consumeServiceCommand.execute(consumeServiceDto);
  }

  @Post('amendment-ledger')
  @ApiOperation({ summary: 'Add amendment ledger' })
  @ApiResponse({ status: 201, description: 'Amendment ledger added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async addAmendmentLedger(@Body() addAmendmentLedgerDto: AddAmendmentLedgerDto) {
    return this.addAmendmentLedgerCommand.execute(addAmendmentLedgerDto);
  }
}
