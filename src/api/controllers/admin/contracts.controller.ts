import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard as AuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { Roles } from '@shared/decorators/roles.decorator';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { CreateContractCommand } from '@application/commands/contract/create-contract.command';
import { GetContractQuery } from '@application/queries/contract/get-contract.query';
import { CreateContractDto } from '@domains/contract/dto/create-contract.dto';

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
    private readonly getContractQuery: GetContractQuery,
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
}
