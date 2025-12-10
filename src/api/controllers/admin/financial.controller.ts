import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Put,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
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
import { GetMentorAppealsQuery } from "@application/queries/financial/get-mentor-appeals.query";
import { GetMentorAppealQuery } from "@application/queries/financial/get-mentor-appeal.query";
import { GetSettlementsQuery } from "@application/queries/financial/get-settlements.query";
import { GetSettlementQuery } from "@application/queries/financial/get-settlement.query";
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
import { GetMentorPricesQuery } from "@application/queries/financial/get-mentor-prices.query";
import { GetMentorPriceQuery } from "@application/queries/financial/get-mentor-price.query";
import { GetAdjustmentChainQuery } from "@application/queries/financial/get-adjustment-chain.query";
import { GetSettlementByMentorAndMonthQuery } from "@application/queries/financial/get-settlement-by-mentor-and-month.query";
import { GetSettlementDetailsQuery } from "@application/queries/financial/get-settlement-details.query";
import { GetPaymentParamsQuery } from "@application/queries/financial/get-payment-params.query";
import { GetMentorPaymentInfoQuery } from "@application/queries/financial/get-mentor-payment-info.query";
import { CreateAppealDto } from "@domains/financial/dto/appeals/create-appeal.dto";
import { RejectAppealDto } from "@domains/financial/dto/appeals/reject-appeal.dto";
import { AppealSearchDto } from "@domains/financial/dto/appeals/appeal-search.dto";
import { IPaginationQuery, ISortQuery } from "@shared/types/pagination.types";
import { ISettlementQuery, ICreateSettlementRequest, IPaymentParamUpdate, ICreateOrUpdateMentorPaymentInfoRequest } from "@domains/financial/dto/settlement";
import { CreateMentorPriceDto } from "@domains/financial/dto/create-mentor-price.dto";
import { UpdateMentorPriceDto } from "@domains/financial/dto/update-mentor-price.dto";
import { UpdateMentorPriceStatusDto } from "@domains/financial/dto/update-mentor-price-status.dto";
import { BulkCreateMentorPriceDto } from "@domains/financial/dto/bulk-create-mentor-price.dto";
import { BulkUpdateMentorPriceDto } from "@domains/financial/dto/bulk-update-mentor-price.dto";
import { MentorPriceSearchDto } from "@domains/financial/dto/mentor-price-search.dto";
import { AdjustPayableLedgerDto } from "@domains/financial/dto/adjust-payable-ledger.dto";

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
@Controller("api/admin/financial")
@ApiTags("Admin Financial")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminFinancialController {
  constructor(
    // 导师申诉相关
    private readonly createMentorAppealCommand: CreateMentorAppealCommand,
    private readonly approveMentorAppealCommand: ApproveMentorAppealCommand,
    private readonly rejectMentorAppealCommand: RejectMentorAppealCommand,
    private readonly getMentorAppealsQuery: GetMentorAppealsQuery,
    private readonly getMentorAppealQuery: GetMentorAppealQuery,

    // 导师价格相关
    private readonly createMentorPriceCommand: CreateMentorPriceCommand,
    private readonly updateMentorPriceCommand: UpdateMentorPriceCommand,
    private readonly updateMentorPriceStatusCommand: UpdateMentorPriceStatusCommand,
    private readonly batchCreateMentorPricesCommand: BatchCreateMentorPricesCommand,
    private readonly batchUpdateMentorPricesCommand: BatchUpdateMentorPricesCommand,
    private readonly getMentorPricesQuery: GetMentorPricesQuery,
    private readonly getMentorPriceQuery: GetMentorPriceQuery,

    // 应付账款相关
    private readonly adjustPayableLedgerCommand: AdjustPayableLedgerCommand,
    private readonly getAdjustmentChainQuery: GetAdjustmentChainQuery,

    // 结算相关
    private readonly getSettlementsQuery: GetSettlementsQuery,
    private readonly getSettlementQuery: GetSettlementQuery,
    private readonly generateSettlementCommand: GenerateSettlementCommand,
    private readonly getSettlementByMentorAndMonthQuery: GetSettlementByMentorAndMonthQuery,
    private readonly getSettlementDetailsQuery: GetSettlementDetailsQuery,

    // 支付参数相关
    private readonly updateOrCreatePaymentParamsCommand: UpdateOrCreatePaymentParamsCommand,
    private readonly modifyPaymentParamsCommand: ModifyPaymentParamsCommand,
    private readonly getPaymentParamsQuery: GetPaymentParamsQuery,

    // 支付信息相关
    private readonly createOrUpdateMentorPaymentInfoCommand: CreateOrUpdateMentorPaymentInfoCommand,
    private readonly getMentorPaymentInfoQuery: GetMentorPaymentInfoQuery,
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

  @Get("mentor-appeals")
  @ApiOperation({ summary: "Get all mentor appeals" })
  @ApiResponse({
    status: 200,
    description: "Mentor appeals retrieved successfully",
  })
  async getMentorAppeals(@Query() query: any) {
    return this.getMentorAppealsQuery.execute({
      filter: query as AppealSearchDto,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
      } as IPaginationQuery,
      sort: {
        field: query.field,
        direction: query.order,
      } as ISortQuery,
    });
  }

  @Get("mentor-appeals/:id")
  @ApiOperation({ summary: "Get mentor appeal by ID" })
  @ApiResponse({
    status: 200,
    description: "Mentor appeal retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Mentor appeal not found" })
  async getMentorAppealById(@Param("id") id: string) {
    return this.getMentorAppealQuery.execute({ id });
  }

  @Patch("mentor-appeals/:id/approve")
  @ApiOperation({ summary: "Approve mentor appeal" })
  @ApiResponse({
    status: 200,
    description: "Mentor appeal approved successfully",
  })
  @ApiResponse({ status: 404, description: "Mentor appeal not found" })
  async approveMentorAppeal(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
  ) {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    return this.approveMentorAppealCommand.execute({
      id,
      approvedBy: String((user as unknown as { id: string }).id),
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

  @Get("settlements")
  @ApiOperation({ summary: "Get all settlements" })
  @ApiResponse({
    status: 200,
    description: "Settlements retrieved successfully",
  })
  async getSettlements(@Query() query: ISettlementQuery) {
    return this.getSettlementsQuery.execute({ query });
  }

  @Get("settlements/mentor/:mentorId/month/:month")
  @ApiOperation({ summary: "Get settlement by mentor and month" })
  @ApiResponse({
    status: 200,
    description: "Settlement retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Settlement not found" })
  async getSettlementByMentorAndMonth(
    @Param("mentorId") mentorId: string,
    @Param("month") month: string,
  ) {
    return this.getSettlementByMentorAndMonthQuery.execute({
      mentorId,
      settlementMonth: month,
    });
  }

  @Get("settlements/:id/details")
  @ApiOperation({ summary: "Get settlement details" })
  @ApiResponse({
    status: 200,
    description: "Settlement details retrieved successfully",
  })
  async getSettlementDetails(@Param("id") id: string) {
    return this.getSettlementDetailsQuery.execute({ settlementId: id });
  }

  @Get("settlements/:id")
  @ApiOperation({ summary: "Get settlement by ID" })
  @ApiResponse({
    status: 200,
    description: "Settlement retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Settlement not found" })
  async getSettlementById(@Param("id") id: string) {
    return this.getSettlementQuery.execute({ id });
  }

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

  @Get("mentor-prices")
  @ApiOperation({ summary: "Search mentor prices" })
  @ApiResponse({
    status: 200,
    description: "Mentor prices retrieved successfully",
  })
  async getMentorPrices(@Query() query: MentorPriceSearchDto) {
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

    return this.getMentorPricesQuery.execute({
      filter: query,
      pagination: {
        page,
        pageSize,
      },
      sort: query.sortField
        ? {
            field: query.sortField,
            order: query.sortOrder || "desc",
          }
        : undefined,
    });
  }

  @Get("mentor-prices/:mentorId/:sessionTypeCode")
  @ApiOperation({ summary: "Get mentor price by mentor ID and session type" })
  @ApiResponse({
    status: 200,
    description: "Mentor price retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Mentor price not found" })
  async getMentorPrice(
    @Param("mentorId") mentorId: string,
    @Param("sessionTypeCode") sessionTypeCode: string,
  ) {
    return this.getMentorPriceQuery.execute({ mentorId, sessionTypeCode });
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

  @Get("payable-ledgers/:id/adjustment-chain")
  @ApiOperation({ summary: "Get adjustment chain" })
  @ApiResponse({
    status: 200,
    description: "Adjustment chain retrieved successfully",
  })
  async getAdjustmentChain(@Param("id") id: string) {
    return this.getAdjustmentChainQuery.execute({ originalLedgerId: id });
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

  @Get("payment-params/:currency/:settlementMonth")
  @ApiOperation({ summary: "Get payment parameters" })
  @ApiResponse({
    status: 200,
    description: "Payment parameters retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Payment parameters not found" })
  async getPaymentParams(
    @Param("currency") currency: string,
    @Param("settlementMonth") settlementMonth: string,
  ) {
    return this.getPaymentParamsQuery.execute({ currency, settlementMonth });
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

  @Get("mentor-payment-infos/:mentorId")
  @ApiOperation({ summary: "Get mentor payment info" })
  @ApiResponse({
    status: 200,
    description: "Mentor payment info retrieved successfully",
  })
  @ApiResponse({ status: 404, description: "Mentor payment info not found" })
  async getMentorPaymentInfo(@Param("mentorId") mentorId: string) {
    return this.getMentorPaymentInfoQuery.execute({ mentorId });
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
