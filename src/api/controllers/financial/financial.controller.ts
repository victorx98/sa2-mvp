import {
  Controller, Post,
  Body,
  Param,
  Patch,
  Put, UseGuards
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { IJwtUser } from "@shared/types/jwt-user.interface";
import { CreateMentorAppealCommand } from "@application/commands/financial/create-mentor-appeal.command";
import { ApproveMentorAppealCommand } from "@application/commands/financial/approve-mentor-appeal.command";
import { RejectMentorAppealCommand } from "@application/commands/financial/reject-mentor-appeal.command";
import { CreateMentorPriceCommand } from "@application/commands/financial/create-mentor-price.command";
import { UpdateMentorPriceCommand } from "@application/commands/financial/update-mentor-price.command";
import { UpdateMentorPriceStatusCommand } from "@application/commands/financial/update-mentor-price-status.command";
import { BatchCreateMentorPricesCommand } from "@application/commands/financial/batch-create-mentor-prices.command";
import { BatchUpdateMentorPricesCommand } from "@application/commands/financial/batch-update-mentor-prices.command";
import { AdjustPayableLedgerCommand } from "@application/commands/financial/adjust-payable-ledger.command";
import { GenerateSettlementCommand } from "@application/commands/financial/generate-settlement.command";
import { UpdateOrCreatePaymentParamsCommand } from "@application/commands/financial/update-or-create-payment-params.command";
import { ModifyPaymentParamsCommand } from "@application/commands/financial/modify-payment-params.command";
import { CreateOrUpdateMentorPaymentInfoCommand } from "@application/commands/financial/create-or-update-mentor-payment-info.command";
import { UpdateMentorPaymentInfoStatusCommand } from "@application/commands/financial/update-mentor-payment-info-status.command";
import { CreateAppealDto } from "@domains/financial/dto/appeals/create-appeal.dto";
import { RejectAppealDto } from "@domains/financial/dto/appeals/reject-appeal.dto";
import { ApproveAppealDto } from "@domains/financial/dto/appeals/approve-appeal.dto";
import { CreateMentorPriceDto } from "@domains/financial/dto/create-mentor-price.dto";
import { UpdateMentorPriceDto } from "@domains/financial/dto/update-mentor-price.dto";
import { UpdateMentorPriceStatusDto } from "@domains/financial/dto/update-mentor-price-status.dto";
import { BulkCreateMentorPriceDto } from "@domains/financial/dto/bulk-create-mentor-price.dto";
import { BulkUpdateMentorPriceDto } from "@domains/financial/dto/bulk-update-mentor-price.dto";
import { AdjustPayableLedgerDto } from "@domains/financial/dto/adjust-payable-ledger.dto";
import { ICreateSettlementRequest, IPaymentParamUpdate } from "@domains/financial/dto/settlement/settlement.dtos";
import { ICreateOrUpdateMentorPaymentInfoRequest } from "@domains/financial/dto/settlement/mentor-payment-info.dtos";

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
@Controller("api/financial")
@ApiTags("Admin Financial")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class FinancialController {
  constructor(
    // 导师申诉相关
    private readonly createMentorAppealCommand: CreateMentorAppealCommand,
    private readonly approveMentorAppealCommand: ApproveMentorAppealCommand,
    private readonly rejectMentorAppealCommand: RejectMentorAppealCommand,

    // 导师价格相关
    private readonly createMentorPriceCommand: CreateMentorPriceCommand,
    private readonly updateMentorPriceCommand: UpdateMentorPriceCommand,
    private readonly updateMentorPriceStatusCommand: UpdateMentorPriceStatusCommand,
    private readonly batchCreateMentorPricesCommand: BatchCreateMentorPricesCommand,
    private readonly batchUpdateMentorPricesCommand: BatchUpdateMentorPricesCommand,

    // 应付账款相关
    private readonly adjustPayableLedgerCommand: AdjustPayableLedgerCommand,

    // 结算相关
    private readonly generateSettlementCommand: GenerateSettlementCommand,

    // 支付参数相关
    private readonly updateOrCreatePaymentParamsCommand: UpdateOrCreatePaymentParamsCommand,
    private readonly modifyPaymentParamsCommand: ModifyPaymentParamsCommand,

    // 支付信息相关
    private readonly createOrUpdateMentorPaymentInfoCommand: CreateOrUpdateMentorPaymentInfoCommand,
    private readonly updateMentorPaymentInfoStatusCommand: UpdateMentorPaymentInfoStatusCommand,
  ) {}

  // ----------------------
  // 导师申诉管理
  // ----------------------

  @Post("mentor-appeals")
  @ApiOperation({ summary: "Create a new mentor appeal" })
  @ApiResponse({
    status: 201,
    description: "Mentor appeal created successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createMentorAppeal(
    @CurrentUser() user: IJwtUser,
    @Body() createMentorAppealDto: CreateAppealDto,
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    return this.createMentorAppealCommand.execute({
      ...createMentorAppealDto,
      createdBy: String((user as unknown as { id: string }).id),
    });
  }



  @Patch("mentor-appeals/:id/approve")
  @ApiOperation({ summary: "Approve mentor appeal" })
  @ApiResponse({
    status: 200,
    description: "Mentor appeal approved successfully",
  })
  @ApiResponse({ status: 404, description: "Mentor appeal not found" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async approveMentorAppeal(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() approveAppealDto: ApproveAppealDto,
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    return this.approveMentorAppealCommand.execute({
      id,
      approvedBy: String((user as unknown as { id: string }).id),
      ...approveAppealDto,
    });
  }

  @Patch("mentor-appeals/:id/reject")
  @ApiOperation({ summary: "Reject mentor appeal" })
  @ApiResponse({
    status: 200,
    description: "Mentor appeal rejected successfully",
  })
  @ApiResponse({ status: 404, description: "Mentor appeal not found" })
  async rejectMentorAppeal(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() rejectAppealDto: RejectAppealDto,
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    return this.rejectMentorAppealCommand.execute({
      id,
      rejectedBy: String((user as unknown as { id: string }).id),
      rejectReason: rejectAppealDto.rejectionReason,
    });
  }

  // ----------------------
  // 结算管理
  // ----------------------

  @Post("settlements")
  @ApiOperation({ summary: "Generate settlement bill" })
  @ApiResponse({
    status: 201,
    description: "Settlement generated successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async generateSettlement(
    @CurrentUser() user: IJwtUser,
    @Body() request: ICreateSettlementRequest,
  ) {
    return this.generateSettlementCommand.execute({
      request,
      createdBy: String((user as unknown as { id: string }).id),
    });
  }

  // ----------------------
  // 导师价格管理
  // ----------------------

  @Post("mentor-prices")
  @ApiOperation({ summary: "Create mentor price" })
  @ApiResponse({
    status: 201,
    description: "Mentor price created successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createMentorPrice(
    @CurrentUser() user: IJwtUser,
    @Body() dto: CreateMentorPriceDto,
  ) {
    return this.createMentorPriceCommand.execute({
      dto,
      updatedBy: String((user as unknown as { id: string }).id),
    });
  }

  @Put("mentor-prices/:id")
  @ApiOperation({ summary: "Update mentor price" })
  @ApiResponse({
    status: 200,
    description: "Mentor price updated successfully",
  })
  @ApiResponse({ status: 404, description: "Mentor price not found" })
  async updateMentorPrice(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() dto: UpdateMentorPriceDto,
  ) {
    return this.updateMentorPriceCommand.execute({
      id,
      dto,
      updatedBy: String((user as unknown as { id: string }).id),
    });
  }

  @Patch("mentor-prices/:id/status")
  @ApiOperation({ summary: "Update mentor price status" })
  @ApiResponse({
    status: 200,
    description: "Mentor price status updated successfully",
  })
  @ApiResponse({ status: 404, description: "Mentor price not found" })
  async updateMentorPriceStatus(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() dto: UpdateMentorPriceStatusDto,
  ) {
    return this.updateMentorPriceStatusCommand.execute({
      id,
      status: dto.status,
      updatedBy: String((user as unknown as { id: string }).id),
    });
  }

  @Post("mentor-prices/batch")
  @ApiOperation({ summary: "Batch create mentor prices" })
  @ApiResponse({
    status: 201,
    description: "Mentor prices created successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async batchCreateMentorPrices(
    @CurrentUser() user: IJwtUser,
    @Body() dto: BulkCreateMentorPriceDto,
  ) {
    return this.batchCreateMentorPricesCommand.execute({
      dtos: dto.prices,
      createdBy: String((user as unknown as { id: string }).id),
    });
  }

  @Put("mentor-prices/batch")
  @ApiOperation({ summary: "Batch update mentor prices" })
  @ApiResponse({
    status: 200,
    description: "Mentor prices updated successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async batchUpdateMentorPrices(
    @CurrentUser() user: IJwtUser,
    @Body() dto: BulkUpdateMentorPriceDto,
  ) {
    return this.batchUpdateMentorPricesCommand.execute({
      updates: dto.updates,
      updatedBy: String((user as unknown as { id: string }).id),
    });
  }

  // ----------------------
  // 应付账款管理
  // ----------------------

  @Post("payable-ledgers/:id/adjust")
  @ApiOperation({ summary: "Adjust payable ledger" })
  @ApiResponse({
    status: 200,
    description: "Payable ledger adjusted successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async adjustPayableLedger(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() dto: AdjustPayableLedgerDto,
  ) {
    return this.adjustPayableLedgerCommand.execute({
      ...dto,
      ledgerId: id,
      createdBy: String((user as unknown as { id: string }).id),
    });
  }

  // ----------------------
  // 支付参数管理
  // ----------------------

  @Put("payment-params/:currency/:settlementMonth")
  @ApiOperation({ summary: "Create or update payment parameters" })
  @ApiResponse({
    status: 200,
    description: "Payment parameters updated successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async updateOrCreatePaymentParams(
    @CurrentUser() user: IJwtUser,
    @Param("currency") currency: string,
    @Param("settlementMonth") settlementMonth: string,
    @Body() params: IPaymentParamUpdate,
  ) {
    return this.updateOrCreatePaymentParamsCommand.execute({
      currency,
      settlementMonth,
      params,
      createdBy: String((user as unknown as { id: string }).id),
    });
  }

  @Patch("payment-params/:currency/:settlementMonth")
  @ApiOperation({ summary: "Modify payment parameters" })
  @ApiResponse({
    status: 200,
    description: "Payment parameters modified successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async modifyPaymentParams(
    @CurrentUser() user: IJwtUser,
    @Param("currency") currency: string,
    @Param("settlementMonth") settlementMonth: string,
    @Body() params: Partial<IPaymentParamUpdate>,
  ) {
    return this.modifyPaymentParamsCommand.execute({
      currency,
      settlementMonth,
      params,
      updatedBy: String((user as unknown as { id: string }).id),
    });
  }

  // ----------------------
  // 支付信息管理
  // ----------------------

  @Put("mentor-payment-infos")
  @ApiOperation({ summary: "Create or update mentor payment info" })
  @ApiResponse({
    status: 200,
    description: "Mentor payment info updated successfully",
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createOrUpdateMentorPaymentInfo(
    @Body() request: ICreateOrUpdateMentorPaymentInfoRequest,
  ) {
    return this.createOrUpdateMentorPaymentInfoCommand.execute(request);
  }

  @Patch("mentor-payment-infos/:id/status")
  @ApiOperation({ summary: "Update mentor payment info status" })
  @ApiResponse({
    status: 200,
    description: "Mentor payment info status updated successfully",
  })
  @ApiResponse({ status: 404, description: "Mentor payment info not found" })
  async updateMentorPaymentInfoStatus(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() dto: { status: "ACTIVE" | "INACTIVE" },
  ) {
    return this.updateMentorPaymentInfoStatusCommand.execute({
      id,
      status: dto.status,
      updatedBy: String((user as unknown as { id: string }).id),
    });
  }
}
