import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
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
import { CreateContractDto } from "@domains/contract/dto/create-contract.dto";
import { UpdateContractDto } from "@domains/contract/dto/update-contract.dto";
import { UpdateContractStatusDto } from "@domains/contract/dto/update-contract-status.dto";
import { ConsumeServiceDto } from "@domains/contract/dto/consume-service.dto";
import { AddAmendmentLedgerDto } from "@domains/contract/dto/add-amendment-ledger.dto";
import { UpdateContractStatusCommand } from "@application/commands/contract/update-contract-status.command";
import { StudentContractsQuery } from "@application/queries/contract/student-contracts.query";
import { ServiceBalanceQuery } from "@application/queries/contract/service-balance.query";
import type { StudentContractResponseDto } from "@domains/contract/dto/student-contracts-query.dto";

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
    description: "Retrieve all service entitlements (balance information) for a student",
  })
  @ApiParam({
    name: "studentId",
    required: true,
    description: "Student ID (UUID)",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Service entitlements retrieved successfully",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          studentId: { type: "string", format: "uuid" },
          serviceType: { type: "string" },
          totalQuantity: { type: "number" },
          consumedQuantity: { type: "number" },
          heldQuantity: { type: "number" },
          availableQuantity: { type: "number" },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid student ID format" })
  @ApiResponse({ status: 404, description: "Student not found" })
  async getStudentServiceBalance(
    @Param("studentId") studentId: string,
  ): Promise<
    Array<{
      studentId: string;
      serviceType: string;
      totalQuantity: number;
      consumedQuantity: number;
      heldQuantity: number;
      availableQuantity: number;
    }>
  > {
    this.logger.log(`Getting service balance for student: ${studentId}`);
    const result = await this.serviceBalanceQuery.getServiceBalance(studentId);
    const mappedResult = result.map((item) => ({
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
    description: "Retrieve all contracts purchased by a student with product information and contract status",
  })
  @ApiParam({
    name: "studentId",
    required: true,
    description: "Student ID (UUID)",
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: "Student contracts retrieved successfully",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          contract_number: { type: "string" },
          product: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
            },
          },
          status: { type: "string", enum: ["DRAFT", "SIGNED", "ACTIVE", "SUSPENDED", "COMPLETED", "TERMINATED"] },
        },
      },
    },
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
    return result;
  }

  @Post()
  @ApiOperation({ summary: "Create a new contract" })
  @ApiResponse({ status: 201, description: "Contract created successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async create(
    @CurrentUser() user: IJwtUser,
    @Body() createContractDto: CreateContractDto,
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    const userId = String((user as unknown as { id: string }).id);
    //  Log request (without sensitive data) [记录请求（不包含敏感数据）]
    this.logger.log(
      `Creating contract for student: ${createContractDto.studentId}, product: ${createContractDto.productId}`,
    );
    const result = await this.createContractCommand.execute(
      createContractDto,
      userId,
    );
    this.logger.log(`Contract created successfully: ${result.id}`);
    return result;
  }



  @Patch(":id/status")
  @ApiOperation({ summary: "Update contract status" })
  @ApiResponse({
    status: 200,
    description: "Contract status updated successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid status transition" })
  @ApiResponse({ status: 404, description: "Contract not found" })
  async updateStatus(
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateContractStatusDto,
    @CurrentUser() user: IJwtUser,
  ) {
    //  Log request (without sensitive data) [记录请求（不包含敏感数据）]
    this.logger.log(
      `Updating contract status - contractId: ${id}, status: ${updateStatusDto.status}`,
    );
    const result = await this.updateContractStatusCommand.execute(
      id,
      updateStatusDto,
      String((user as unknown as { id: string }).id),
    );
    this.logger.log(`Contract status updated successfully: ${id}`);
    return result;
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update contract" })
  @ApiResponse({ status: 200, description: "Contract updated successfully" })
  @ApiResponse({ status: 404, description: "Contract not found" })
  async update(
    @Param("id") id: string,
    @Body() updateContractDto: UpdateContractDto,
  ) {
    //  Log request (without sensitive data) [记录请求（不包含敏感数据）]
    this.logger.log(`Updating contract: ${id}`);
    const result = await this.updateContractCommand.execute(
      id,
      updateContractDto,
    );
    this.logger.log(`Contract updated successfully: ${id}`);
    return result;
  }

  @Post("consume")
  @ApiOperation({ summary: "Consume service" })
  @ApiResponse({ status: 200, description: "Service consumed successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Student or entitlement not found" })
  async consumeService(
    @Body() consumeServiceDto: ConsumeServiceDto,
    @CurrentUser() user: IJwtUser,
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    const userId = String((user as unknown as { id: string }).id);
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
  @ApiOperation({ summary: "Add amendment ledger" })
  @ApiResponse({
    status: 201,
    description: "Amendment ledger added successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async addAmendmentLedger(
    @Body() addAmendmentLedgerDto: AddAmendmentLedgerDto,
  ) {
    //  Log request (without sensitive data) [记录请求（不包含敏感数据）]
    this.logger.log(
      `Adding amendment ledger - contractId: ${addAmendmentLedgerDto.contractId}, studentId: ${addAmendmentLedgerDto.studentId}, serviceType: ${addAmendmentLedgerDto.serviceType}`,
    );
    const result = await this.addAmendmentLedgerCommand.execute(
      addAmendmentLedgerDto,
    );
    this.logger.log(`Amendment ledger added successfully`);
    return result;
  }
}
