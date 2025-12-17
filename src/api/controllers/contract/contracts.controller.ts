import {
  Controller,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Logger,
  Get,
  Query,
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
import { ApiPrefix } from "@api/api.constants";
import { JwtAuthGuard as AuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import type { IJwtUser } from "@shared/types/jwt-user.interface";
import { CreateContractCommand } from "@application/commands/contract/create-contract.command";
import { UpdateContractCommand } from "@application/commands/contract/update-contract.command";
import { ConsumeServiceCommand } from "@application/commands/contract/consume-service.command";
import { AddAmendmentLedgerCommand } from "@application/commands/contract/add-amendment-ledger.command";
import type { CreateContractDto } from "@domains/contract/dto/create-contract.dto";
import type { UpdateContractDto } from "@domains/contract/dto/update-contract.dto";
import type { UpdateContractStatusDto } from "@domains/contract/dto/update-contract-status.dto";
import type { ConsumeServiceDto } from "@domains/contract/dto/consume-service.dto";
import type { AddAmendmentLedgerDto } from "@domains/contract/dto/add-amendment-ledger.dto";
import { UpdateContractStatusCommand } from "@application/commands/contract/update-contract-status.command";
import { StudentContractsQuery } from "@application/queries/contract/student-contracts.query";
import { ServiceBalanceQuery } from "@application/queries/contract/service-balance.query";
import { ServiceBalanceResponseDto } from "@api/dto/response/service-balance-response.dto";
import {
  AddAmendmentLedgerRequestDto,
  ConsumeServiceRequestDto,
  CreateContractRequestDto,
  UpdateContractRequestDto,
  UpdateContractStatusRequestDto,
} from "@api/dto/request/contract/contract.request.dto";
import {
  ConsumeServiceResponseDto,
  ContractResponseDto,
  ContractServiceEntitlementResponseDto,
  StudentContractResponseDto,
} from "@api/dto/response/contract/contract.response.dto";
import { ContractListQueryDto } from "@api/dto/request/contract/contract-list.request.dto";
import { ContractListResponseDto } from "@api/dto/response/contract/contract-list.response.dto";
import { ContractStatus } from "@shared/types/contract-enums";

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
@Controller(`${ApiPrefix}/contracts`)
@ApiTags("Admin Contracts")
@UseGuards(AuthGuard, RolesGuard)
@Roles("admin", "manager", "counselor")
@ApiBearerAuth()
export class ContractsController {
  private readonly logger = new Logger(ContractsController.name);

  constructor(
    private readonly createContractCommand: CreateContractCommand,
    private readonly updateContractStatusCommand: UpdateContractStatusCommand,
    private readonly updateContractCommand: UpdateContractCommand,
    private readonly consumeServiceCommand: ConsumeServiceCommand,
    private readonly addAmendmentLedgerCommand: AddAmendmentLedgerCommand,
    private readonly studentContractsQuery: StudentContractsQuery,
    private readonly serviceBalanceQuery: ServiceBalanceQuery,
  ) { }

  @Get("students/:studentId/service-balance")
  @ApiOperation({
    summary: "Get service entitlements for a specific student",
    description:
      "Retrieve all service entitlements (balance information) for a student. [获取学生的服务权益余额信息]",
  })
  @ApiParam({
    name: "studentId",
    required: true,
    description: "Student ID (UUID). [学生ID(UUID)]",
    type: String,
  })
  @ApiOkResponse({
    description: "Service entitlements retrieved successfully",
    type: ServiceBalanceResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: "Invalid student ID format" })
  @ApiResponse({ status: 404, description: "Student not found" })
  async getStudentServiceBalance(
    @Param("studentId") studentId: string,
  ): Promise<ServiceBalanceResponseDto[]> {
    this.logger.log(`Getting service balance for student: ${studentId}`);
    const result = await this.serviceBalanceQuery.getServiceBalance(studentId);
    const mappedResult: ServiceBalanceResponseDto[] = result.map((item) => ({
      studentId: item.studentId,
      serviceType: item.serviceType,
      totalQuantity: item.totalQuantity,
      consumedQuantity: item.consumedQuantity,
      heldQuantity: item.heldQuantity,
      availableQuantity: item.availableQuantity,
    }));
    this.logger.log(
      `Retrieved ${mappedResult.length} service entitlement(s) for student: ${studentId}`,
    );
    return mappedResult;
  }

  @Get("students/:studentId")
  @ApiOperation({
    summary: "Get contracts purchased by a specific student",
    description:
      "Retrieve all contracts purchased by a student with product information and contract status. [查询学生购买的合同列表，包含产品摘要与合同状态]",
  })
  @ApiParam({
    name: "studentId",
    required: true,
    description: "Student ID (UUID). [学生ID(UUID)]",
    type: String,
  })
  @ApiOkResponse({
    description: "Student contracts retrieved successfully",
    type: StudentContractResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: "Invalid student ID format" })
  @ApiResponse({ status: 404, description: "Student not found" })
  async getStudentContracts(
    @Param("studentId") studentId: string,
  ): Promise<StudentContractResponseDto[]> {
    this.logger.log(`Getting contracts for student: ${studentId}`);
    const result = await this.studentContractsQuery.getStudentContracts(
      studentId,
    );
    this.logger.log(
      `Retrieved ${result.length} contract(s) for student: ${studentId}`,
    );
    return result.map(item => ({
      ...item,
      status: item.status as ContractStatus,
    }));
  }

  @Get()
  @ApiOperation({ summary: "Get contracts list with pagination and filters", description: "Retrieve paginated contracts list with various filter options" })
  @ApiOkResponse({
    description: "Contracts retrieved successfully",
    type: ContractListResponseDto,
  })
  async getContracts(
    @Query() queryDto: ContractListQueryDto,
  ): Promise<ContractListResponseDto> {
    const result = await this.studentContractsQuery.getContractsWithPagination(
      {
        studentId: queryDto.studentId,
        status: queryDto.status,
        productId: queryDto.productId,
        startDate: queryDto.startDate,
        endDate: queryDto.endDate,
        keyword: queryDto.keyword,
      },
      {
        page: queryDto.page || 1,
        pageSize: queryDto.pageSize || 20,
      },
    );

    // Map status to ContractStatus enum
    return {
      data: result.data.map((item: any) => ({
        ...item,
        status: item.status as ContractStatus,
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  @Post()
  @ApiOperation({
    summary: "Create a new contract",
    description:
      "Creates a contract from a frozen product snapshot. [基于产品快照创建合同]",
  })
  @ApiBody({ type: CreateContractRequestDto })
  @ApiCreatedResponse({
    description: "Contract created successfully",
    type: ContractResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async create(
    @CurrentUser() user: IJwtUser,
    @Body() body: CreateContractRequestDto,
  ): Promise<ContractResponseDto> {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    const userId = String((user as unknown as { id: string }).id);
    const createContractDto: CreateContractDto = body as unknown as CreateContractDto;
    //  Log request (without sensitive data) [记录请求（不包含敏感数据）]
    this.logger.log(
      `Creating contract for student: ${createContractDto.studentId}, product: ${createContractDto.productId}`,
    );
    const result = await this.createContractCommand.execute(
      createContractDto,
      userId,
    );
    this.logger.log(`Contract created successfully: ${result.id}`);
    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      productSnapshot: {
        ...result.productSnapshot,
        snapshotAt: result.productSnapshot.snapshotAt.toISOString(),
      },
    };
  }



  @Patch(":id/status")
  @ApiOperation({
    summary: "Update contract status",
    description:
      "Updates contract status with optional reason/signer. [更新合同状态，可选原因/签署人]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Contract ID (UUID). [合同ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: UpdateContractStatusRequestDto })
  @ApiOkResponse({
    description: "Contract status updated successfully",
    type: ContractResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid status transition" })
  @ApiResponse({ status: 404, description: "Contract not found" })
  async updateStatus(
    @Param("id") id: string,
    @Body() body: UpdateContractStatusRequestDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<ContractResponseDto> {
    //  Log request (without sensitive data) [记录请求（不包含敏感数据）]
    this.logger.log(
      `Updating contract status - contractId: ${id}, status: ${body.status}`,
    );
    const updateStatusDto: UpdateContractStatusDto = body as unknown as UpdateContractStatusDto;
    const result = await this.updateContractStatusCommand.execute(
      id,
      updateStatusDto,
      String((user as unknown as { id: string }).id),
    );
    this.logger.log(`Contract status updated successfully: ${id}`);
    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      productSnapshot: {
        ...result.productSnapshot,
        snapshotAt: result.productSnapshot.snapshotAt.toISOString(),
      },
    };
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update contract",
    description:
      "Updates contract core fields (title/amount/currency/validity). [更新合同核心字段(标题/金额/币种/有效期)]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Contract ID (UUID). [合同ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: UpdateContractRequestDto })
  @ApiOkResponse({
    description: "Contract updated successfully",
    type: ContractResponseDto,
  })
  @ApiResponse({ status: 404, description: "Contract not found" })
  async update(
    @Param("id") id: string,
    @Body() body: UpdateContractRequestDto,
  ): Promise<ContractResponseDto> {
    //  Log request (without sensitive data) [记录请求（不包含敏感数据）]
    this.logger.log(`Updating contract: ${id}`);
    const updateContractDto: UpdateContractDto = body as unknown as UpdateContractDto;
    const result = await this.updateContractCommand.execute(
      id,
      updateContractDto,
    );
    this.logger.log(`Contract updated successfully: ${id}`);
    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      productSnapshot: {
        ...result.productSnapshot,
        snapshotAt: result.productSnapshot.snapshotAt.toISOString(),
      },
    };
  }

  @Post("consume")
  @ApiOperation({
    summary: "Consume service",
    description:
      "Consumes student entitlements when a service is delivered (e.g., session completed). [在服务交付后消费学生权益，例如会话完成]",
  })
  @ApiBody({ type: ConsumeServiceRequestDto })
  @ApiOkResponse({
    description: "Service consumed successfully",
    type: ConsumeServiceResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Student or entitlement not found" })
  async consumeService(
    @Body() body: ConsumeServiceRequestDto,
    @CurrentUser() user: IJwtUser,
  ): Promise<ConsumeServiceResponseDto> {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    const userId = String((user as unknown as { id: string }).id);
    const consumeServiceDto: ConsumeServiceDto = body as unknown as ConsumeServiceDto;
    //  Log request (without sensitive data) [记录请求（不包含敏感数据）]
    this.logger.log(
      `Consuming service - studentId: ${consumeServiceDto.studentId}, serviceType: ${consumeServiceDto.serviceType}, quantity: ${consumeServiceDto.quantity}`,
    );
    const result = await this.consumeServiceCommand.execute(
      consumeServiceDto,
      userId,
    );
    this.logger.log(
      `Service consumed successfully - studentId: ${consumeServiceDto.studentId}, serviceType: ${consumeServiceDto.serviceType}`,
    );
    return result;
  }

  @Post("amendment-ledger")
  @ApiOperation({
    summary: "Add amendment ledger",
    description:
      "Adds entitlement amendment ledger entry and returns updated entitlement record. [添加权益变更台账并返回更新后的权益记录]",
  })
  @ApiBody({ type: AddAmendmentLedgerRequestDto })
  @ApiCreatedResponse({
    description: "Amendment ledger added successfully",
    type: ContractServiceEntitlementResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async addAmendmentLedger(
    @Body() body: AddAmendmentLedgerRequestDto,
  ): Promise<ContractServiceEntitlementResponseDto> {
    //  Log request (without sensitive data) [记录请求（不包含敏感数据）]
    const addAmendmentLedgerDto: AddAmendmentLedgerDto =
      body as unknown as AddAmendmentLedgerDto;
    this.logger.log(
      `Adding amendment ledger - contractId: ${addAmendmentLedgerDto.contractId}, studentId: ${addAmendmentLedgerDto.studentId}, serviceType: ${addAmendmentLedgerDto.serviceType}`,
    );
    const result = await this.addAmendmentLedgerCommand.execute(
      addAmendmentLedgerDto,
    );
    this.logger.log(`Amendment ledger added successfully`);
    return {
      ...result,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
