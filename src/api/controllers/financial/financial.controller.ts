import {
  Controller,
  Post,
  Body,
  Param,
  Patch,
  Put,
  UseGuards,
  Get,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import type { IJwtUser } from "@shared/types/jwt-user.interface";
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
import { CreateClassMentorPriceCommand } from "@application/commands/financial/create-class-mentor-price.command";
import { UpdateClassMentorPriceCommand } from "@application/commands/financial/update-class-mentor-price.command";
import { UpdateClassMentorPriceStatusCommand } from "@application/commands/financial/update-class-mentor-price-status.command";
import type { CreateAppealDto } from "@domains/financial/dto/appeals/create-appeal.dto";
import type { ApproveAppealDto } from "@domains/financial/dto/appeals/approve-appeal.dto";
import type { RejectAppealDto } from "@domains/financial/dto/appeals/reject-appeal.dto";
import type { CreateMentorPriceDto } from "@domains/financial/dto/create-mentor-price.dto";
import type { UpdateMentorPriceDto } from "@domains/financial/dto/update-mentor-price.dto";
import type { UpdateMentorPriceStatusDto } from "@domains/financial/dto/update-mentor-price-status.dto";
import type { CreateClassMentorPriceDto } from "@domains/financial/dto/create-class-mentor-price.dto";
import type { UpdateClassMentorPriceDto } from "@domains/financial/dto/update-class-mentor-price.dto";
import type { UpdateClassMentorPriceStatusDto } from "@domains/financial/dto/update-class-mentor-price-status.dto";
import type { ClassMentorPriceFilterDto } from "@domains/financial/dto/class-mentor-price-filter.dto";
import type { ICreateSettlementRequest, IPaymentParamUpdate } from "@domains/financial/dto/settlement";
import type { ICreateOrUpdateMentorPaymentInfoRequest } from "@domains/financial/dto/settlement";
import { ClassMentorPriceQueryService } from "@domains/query/financial/class-mentor-price-query.service";
import {
  ApproveMentorAppealRequestDto,
  CreateMentorAppealRequestDto,
  RejectMentorAppealRequestDto,
} from "@api/dto/request/financial/mentor-appeal.request.dto";
import { MentorAppealResponseDto } from "@api/dto/response/financial/mentor-appeal.response.dto";
import {
  BulkCreateMentorPriceRequestDto,
  BulkUpdateMentorPriceRequestDto,
  CreateMentorPriceRequestDto,
  UpdateMentorPriceRequestDto,
  UpdateMentorPriceStatusRequestDto,
} from "@api/dto/request/financial/mentor-price.request.dto";
import { MentorPriceResponseDto } from "@api/dto/response/financial/mentor-price.response.dto";
import {
  CreateSettlementRequestDto,
  ModifyPaymentParamsRequestDto,
  PaymentParamUpdateRequestDto,
  UpdateMentorPaymentInfoStatusRequestDto,
} from "@api/dto/request/financial/settlement.request.dto";
import { AdjustPayableLedgerRequestDto } from "@api/dto/request/financial/payable-ledger.request.dto";
import {
  CreateOrUpdateMentorPaymentInfoRequestDto,
} from "@api/dto/request/financial/mentor-payment-info.request.dto";
import {
  MentorPaymentInfoResponseDto,
  SettlementDetailResponseDto,
} from "@api/dto/response/financial/settlement.response.dto";
import {
  ClassMentorPriceResponseDto,
  ClassMentorPriceWithMentorResponseDto,
  PaginatedClassMentorPriceResponseDto,
} from "@api/dto/response/financial/class-mentor-price.response.dto";
import {
  CreateClassMentorPriceRequestDto,
  SearchClassMentorPricesQueryDto,
  UpdateClassMentorPriceRequestDto,
  UpdateClassMentorPriceStatusRequestDto,
} from "@api/dto/request/financial/class-mentor-price.request.dto";
import {
  ChannelBatchPayPaymentDetailsDto,
  CheckPaymentDetailsDto,
  DomesticTransferPaymentDetailsDto,
  GustoInternationalPaymentDetailsDto,
  GustoPaymentDetailsDto,
} from "@api/dto/request/financial/payment-details.dto";
import type { AdjustPayableLedgerDto } from "@domains/financial/dto/adjust-payable-ledger.dto";
import { SettlementMethod } from "@domains/financial/dto/settlement";
import type { ClassMentorPriceWithMentor } from "@domains/query/financial/class-mentor-price-query.service";
import type { ClassMentorPrice, MentorPrice } from "@infrastructure/database/schema";

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
@ApiTags("Financial")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@ApiBearerAuth()
@ApiExtraModels(
  DomesticTransferPaymentDetailsDto,
  GustoPaymentDetailsDto,
  GustoInternationalPaymentDetailsDto,
  CheckPaymentDetailsDto,
  ChannelBatchPayPaymentDetailsDto,
)
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

    // 班级导师价格相关
    private readonly createClassMentorPriceCommand: CreateClassMentorPriceCommand,
    private readonly updateClassMentorPriceCommand: UpdateClassMentorPriceCommand,
    private readonly updateClassMentorPriceStatusCommand: UpdateClassMentorPriceStatusCommand,

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

    // 班级导师价格查询相关
    private readonly classMentorPriceQueryService: ClassMentorPriceQueryService,
  ) {}

  // Helper methods for mapping domain objects to DTOs [将领域对象映射到DTO的辅助方法]
  private mapMentorPriceToDto(price: MentorPrice): MentorPriceResponseDto {
    return {
      id: price.id,
      mentorUserId: price.mentorUserId,
      serviceTypeId: price.serviceTypeId ?? null,
      sessionTypeCode: price.sessionTypeCode ?? null,
      packageCode: price.packageCode ?? null,
      price: String(price.price),
      currency: price.currency,
      status: price.status,
      updatedBy: price.updatedBy ?? null,
      createdAt: price.createdAt.toISOString(),
      updatedAt: price.updatedAt.toISOString(),
    };
  }

  private mapClassMentorPriceToDto(price: ClassMentorPrice): ClassMentorPriceResponseDto {
    return {
      id: price.id,
      classId: price.classId,
      mentorUserId: price.mentorUserId,
      pricePerSession: price.pricePerSession,
      status: price.status,
      createdAt: price.createdAt.toISOString(),
      updatedAt: price.updatedAt.toISOString(),
    };
  }

  private mapClassMentorPriceWithMentorToDto(
    price: ClassMentorPriceWithMentor,
  ): ClassMentorPriceWithMentorResponseDto {
    return {
      id: price.id,
      classId: price.classId,
      mentor: {
        id: price.mentor.id,
        nameEn: price.mentor.nameEn,
        nameZh: price.mentor.nameZh,
      },
      pricePerSession: price.pricePerSession,
      status: price.status,
      createdAt: price.createdAt.toISOString(),
      updatedAt: price.updatedAt.toISOString(),
    };
  }

  private mapMentorPaymentInfoToDto(paymentInfo: {
    id: string;
    mentorId: string;
    paymentCurrency: string;
    paymentMethod: SettlementMethod;
    paymentDetails: Record<string, unknown>;
    status: string;
    createdAt: Date | string;
    updatedAt: Date | string;
    updatedBy?: string;
  }): MentorPaymentInfoResponseDto {
    return {
      id: paymentInfo.id,
      mentorId: paymentInfo.mentorId,
      paymentCurrency: paymentInfo.paymentCurrency,
      paymentMethod: paymentInfo.paymentMethod,
      paymentDetails: this.mapPaymentDetailsByMethod(
        paymentInfo.paymentMethod,
        paymentInfo.paymentDetails,
      ),
      status: paymentInfo.status,
      createdAt:
        paymentInfo.createdAt instanceof Date
          ? paymentInfo.createdAt.toISOString()
          : paymentInfo.createdAt,
      updatedAt:
        paymentInfo.updatedAt instanceof Date
          ? paymentInfo.updatedAt.toISOString()
          : paymentInfo.updatedAt,
      updatedBy: paymentInfo.updatedBy,
    };
  }

  private mapPaymentDetailsByMethod(
    method: SettlementMethod,
    paymentDetails: Record<string, unknown>,
  ): MentorPaymentInfoResponseDto["paymentDetails"] {
    // Map polymorphic JSON details to Swagger DTO union type [将多态JSON详情映射为Swagger DTO联合类型]
    switch (method) {
      case SettlementMethod.DOMESTIC_TRANSFER:
        return paymentDetails as unknown as DomesticTransferPaymentDetailsDto;
      case SettlementMethod.GUSTO:
        return paymentDetails as unknown as GustoPaymentDetailsDto;
      case SettlementMethod.GUSTO_INTERNATIONAL:
        return paymentDetails as unknown as GustoInternationalPaymentDetailsDto;
      case SettlementMethod.CHECK:
        return paymentDetails as unknown as CheckPaymentDetailsDto;
      case SettlementMethod.CHANNEL_BATCH_PAY:
        return paymentDetails as unknown as ChannelBatchPayPaymentDetailsDto;
      default: {
        // Exhaustiveness check for future enum extensions [未来枚举扩展的穷尽性检查]
        const _exhaustive: never = method;
        return _exhaustive;
      }
    }
  }

  // ----------------------
  // 导师申诉管理
  // ----------------------

  @Post("mentor-appeals")
  @ApiOperation({
    summary: "Create a new mentor appeal",
    description:
      "Creates a mentor appeal record and sets createdBy from current user. [创建导师申诉记录，createdBy 从当前用户注入]",
  })
  @ApiBody({ type: CreateMentorAppealRequestDto })
  @ApiCreatedResponse({
    description: "Mentor appeal created successfully",
    type: MentorAppealResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createMentorAppeal(
    @CurrentUser() user: IJwtUser,
    @Body() body: CreateMentorAppealRequestDto,
  ): Promise<MentorAppealResponseDto> {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    const createMentorAppealDto: CreateAppealDto =
      body as unknown as CreateAppealDto;
    const appeal = await this.createMentorAppealCommand.execute({
      ...createMentorAppealDto,
      createdBy: String((user as unknown as { id: string }).id),
    });
    return {
      ...appeal,
      approvedAt: appeal.approvedAt?.toISOString(),
      rejectedAt: appeal.rejectedAt?.toISOString(),
      createdAt: appeal.createdAt.toISOString(),
    };
  }



  @Patch("mentor-appeals/:id/approve")
  @ApiOperation({
    summary: "Approve mentor appeal",
    description:
      "Approves a pending mentor appeal and optionally overrides amount/currency. [批准待处理导师申诉，可选覆盖金额/币种]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Appeal ID (UUID). [申诉ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: ApproveMentorAppealRequestDto })
  @ApiOkResponse({
    description: "Mentor appeal approved successfully",
    type: MentorAppealResponseDto,
  })
  @ApiResponse({ status: 404, description: "Mentor appeal not found" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async approveMentorAppeal(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() body: ApproveMentorAppealRequestDto,
  ): Promise<MentorAppealResponseDto> {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    const approveAppealDto: ApproveAppealDto = body as unknown as ApproveAppealDto;
    const appeal = await this.approveMentorAppealCommand.execute({
      id,
      approvedBy: String((user as unknown as { id: string }).id),
      ...approveAppealDto,
    });
    return {
      ...appeal,
      approvedAt: appeal.approvedAt?.toISOString(),
      rejectedAt: appeal.rejectedAt?.toISOString(),
      createdAt: appeal.createdAt.toISOString(),
    };
  }

  @Patch("mentor-appeals/:id/reject")
  @ApiOperation({
    summary: "Reject mentor appeal",
    description:
      "Rejects a pending mentor appeal and records rejection reason. [驳回待处理导师申诉并记录驳回理由]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Appeal ID (UUID). [申诉ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: RejectMentorAppealRequestDto })
  @ApiOkResponse({
    description: "Mentor appeal rejected successfully",
    type: MentorAppealResponseDto,
  })
  @ApiResponse({ status: 404, description: "Mentor appeal not found" })
  async rejectMentorAppeal(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() body: RejectMentorAppealRequestDto,
  ): Promise<MentorAppealResponseDto> {
    // Guard ensures user is authenticated and has valid structure [守卫确保用户已认证且结构有效]
    const rejectAppealDto: RejectAppealDto = body as unknown as RejectAppealDto;
    const appeal = await this.rejectMentorAppealCommand.execute({
      id,
      rejectedBy: String((user as unknown as { id: string }).id),
      rejectReason: rejectAppealDto.rejectionReason,
    });
    return {
      ...appeal,
      approvedAt: appeal.approvedAt?.toISOString(),
      rejectedAt: appeal.rejectedAt?.toISOString(),
      createdAt: appeal.createdAt.toISOString(),
    };
  }

  // ----------------------
  // 结算管理
  // ----------------------

  @Post("settlements")
  @ApiOperation({
    summary: "Generate settlement bill",
    description:
      "Generates a settlement ledger for a mentor and month. [为指定导师与月份生成结算记录]",
  })
  @ApiBody({ type: CreateSettlementRequestDto })
  @ApiCreatedResponse({
    description: "Settlement generated successfully",
    type: SettlementDetailResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async generateSettlement(
    @CurrentUser() user: IJwtUser,
    @Body() body: CreateSettlementRequestDto,
  ): Promise<SettlementDetailResponseDto> {
    const request: ICreateSettlementRequest = body as unknown as ICreateSettlementRequest;
    const settlement = await this.generateSettlementCommand.execute({
      request,
      createdBy: String((user as unknown as { id: string }).id),
    });
    return {
      ...settlement,
      originalAmount: String(settlement.originalAmount),
      targetAmount: String(settlement.targetAmount),
      exchangeRate: String(settlement.exchangeRate),
      deductionRate: String(settlement.deductionRate),
      createdAt: settlement.createdAt.toISOString(),
    };
  }

  // ----------------------
  // 导师价格管理
  // ----------------------

  @Post("mentor-prices")
  @ApiOperation({
    summary: "Create mentor price",
    description:
      "Creates mentor pricing configuration for a session type. [创建导师某会话类型的价格配置]",
  })
  @ApiBody({ type: CreateMentorPriceRequestDto })
  @ApiCreatedResponse({
    description: "Mentor price created successfully",
    type: MentorPriceResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createMentorPrice(
    @CurrentUser() user: IJwtUser,
    @Body() body: CreateMentorPriceRequestDto,
  ): Promise<MentorPriceResponseDto> {
    const dto: CreateMentorPriceDto = body as unknown as CreateMentorPriceDto;
    const price = await this.createMentorPriceCommand.execute({
      dto,
      updatedBy: String((user as unknown as { id: string }).id),
    });
    return this.mapMentorPriceToDto(price);
  }

  @Put("mentor-prices/:id")
  @ApiOperation({
    summary: "Update mentor price",
    description:
      "Updates mentor pricing configuration fields. [更新导师价格配置字段]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Mentor price ID (UUID). [导师价格ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: UpdateMentorPriceRequestDto })
  @ApiOkResponse({
    description: "Mentor price updated successfully",
    type: MentorPriceResponseDto,
  })
  @ApiResponse({ status: 404, description: "Mentor price not found" })
  async updateMentorPrice(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() body: UpdateMentorPriceRequestDto,
  ): Promise<MentorPriceResponseDto> {
    const dto: UpdateMentorPriceDto = body as unknown as UpdateMentorPriceDto;
    const price = await this.updateMentorPriceCommand.execute({
      id,
      dto,
      updatedBy: String((user as unknown as { id: string }).id),
    });
    return this.mapMentorPriceToDto(price);
  }

  @Patch("mentor-prices/:id/status")
  @ApiOperation({
    summary: "Update mentor price status",
    description:
      "Activates or deactivates a mentor price record. [启用/停用导师价格记录]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Mentor price ID (UUID). [导师价格ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: UpdateMentorPriceStatusRequestDto })
  @ApiOkResponse({
    description: "Mentor price status updated successfully",
  })
  @ApiResponse({ status: 404, description: "Mentor price not found" })
  async updateMentorPriceStatus(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() body: UpdateMentorPriceStatusRequestDto,
  ): Promise<void> {
    const dto: UpdateMentorPriceStatusDto =
      body as unknown as UpdateMentorPriceStatusDto;
    return this.updateMentorPriceStatusCommand.execute({
      id,
      status: dto.status,
      updatedBy: String((user as unknown as { id: string }).id),
    });
  }

  @Post("mentor-prices/batch")
  @ApiOperation({
    summary: "Batch create mentor prices",
    description:
      "Creates multiple mentor price records in one request. [一次请求批量创建导师价格记录]",
  })
  @ApiBody({ type: BulkCreateMentorPriceRequestDto })
  @ApiCreatedResponse({
    description: "Mentor prices created successfully",
    type: MentorPriceResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async batchCreateMentorPrices(
    @CurrentUser() user: IJwtUser,
    @Body() body: BulkCreateMentorPriceRequestDto,
  ): Promise<MentorPriceResponseDto[]> {
    const dtos: CreateMentorPriceDto[] = body.prices as unknown as CreateMentorPriceDto[];
    const prices = await this.batchCreateMentorPricesCommand.execute({
      dtos,
      createdBy: String((user as unknown as { id: string }).id),
    });
    return prices.map(p => this.mapMentorPriceToDto(p));
  }

  @Put("mentor-prices/batch")
  @ApiOperation({
    summary: "Batch update mentor prices",
    description:
      "Updates multiple mentor price records in one request. [一次请求批量更新导师价格记录]",
  })
  @ApiBody({ type: BulkUpdateMentorPriceRequestDto })
  @ApiOkResponse({
    description: "Mentor prices updated successfully",
    type: MentorPriceResponseDto,
    isArray: true,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async batchUpdateMentorPrices(
    @CurrentUser() user: IJwtUser,
    @Body() body: BulkUpdateMentorPriceRequestDto,
  ): Promise<MentorPriceResponseDto[]> {
    const updates = body.updates as unknown as Array<{ id: string; dto: UpdateMentorPriceDto }>;
    const prices = await this.batchUpdateMentorPricesCommand.execute({
      updates,
      updatedBy: String((user as unknown as { id: string }).id),
    });
    return prices.map(p => this.mapMentorPriceToDto(p));
  }

  // ----------------------
  // 班级导师价格管理
  // ----------------------

  @Post("class-mentor-prices")
  @ApiOperation({
    summary: "Create class mentor price",
    description:
      "Creates class-level mentor price configuration. [创建班级维度的导师价格配置]",
  })
  @ApiBody({ type: CreateClassMentorPriceRequestDto })
  @ApiCreatedResponse({
    description: "Class mentor price created successfully",
    type: ClassMentorPriceResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createClassMentorPrice(
    @CurrentUser() user: IJwtUser,
    @Body() body: CreateClassMentorPriceRequestDto,
  ): Promise<ClassMentorPriceResponseDto> {
    const dto: CreateClassMentorPriceDto =
      body as unknown as CreateClassMentorPriceDto;
    const price = await this.createClassMentorPriceCommand.execute({
      dto,
      updatedBy: String((user as unknown as { id: string }).id),
    });
    return this.mapClassMentorPriceToDto(price);
  }

  @Get("class-mentor-prices/:id")
  @ApiOperation({
    summary: "Get class mentor price by ID",
    description:
      "Returns class mentor price with mentor name info. [按ID查询班级导师价格，包含导师姓名信息]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Class mentor price ID (UUID). [班级导师价格ID(UUID)]",
    type: String,
  })
  @ApiOkResponse({
    description: "Class mentor price retrieved successfully",
    type: ClassMentorPriceWithMentorResponseDto,
  })
  @ApiResponse({ status: 404, description: "Class mentor price not found" })
  async getClassMentorPriceById(
    @Param("id") id: string,
  ): Promise<ClassMentorPriceWithMentorResponseDto | null> {
    const result = await this.classMentorPriceQueryService.findOne({ id });
    return result ? this.mapClassMentorPriceWithMentorToDto(result) : null;
  }

  @Get("class-mentor-prices")
  @ApiOperation({
    summary: "Search class mentor prices",
    description:
      "Searches class mentor prices with filters, pagination and sorting. [按条件查询班级导师价格，支持分页与排序]",
  })
  @ApiOkResponse({
    description: "Class mentor prices retrieved successfully",
    type: PaginatedClassMentorPriceResponseDto,
  })
  async searchClassMentorPrices(
    @Query() query: SearchClassMentorPricesQueryDto,
  ): Promise<PaginatedClassMentorPriceResponseDto> {
    const filter: ClassMentorPriceFilterDto = {};
    if (query.classId) filter.classId = query.classId;
    if (query.mentorUserId) filter.mentorUserId = query.mentorUserId;
    if (query.status) filter.status = query.status;

    const normalizedSortField = query.sortField && query.sortField.trim()
      ? query.sortField.trim()
      : "createdAt";
    const normalizedSortOrder: "asc" | "desc" =
      query.sortOrder === "asc" || query.sortOrder === "desc"
        ? query.sortOrder
        : "desc";

    const result = await this.classMentorPriceQueryService.search(
      filter,
      { page: query.page, pageSize: query.pageSize },
      { field: normalizedSortField, order: normalizedSortOrder },
    );
    return {
      ...result,
      data: result.data.map(item => this.mapClassMentorPriceWithMentorToDto(item)),
    };
  }

  @Get("class-mentor-prices/by-class-and-mentor")
  @ApiOperation({
    summary: "Get class mentor price by class and mentor",
    description:
      "Finds a class mentor price record by classId and mentorUserId. [按班级ID与导师ID查询班级导师价格记录]",
  })
  @ApiQuery({
    name: "classId",
    required: true,
    description: "Class ID (UUID). [班级ID(UUID)]",
    type: String,
  })
  @ApiQuery({
    name: "mentorUserId",
    required: true,
    description: "Mentor user ID (UUID). [导师用户ID(UUID)]",
    type: String,
  })
  @ApiOkResponse({
    description: "Class mentor price retrieved successfully",
    type: ClassMentorPriceWithMentorResponseDto,
  })
  async getClassMentorPriceByClassAndMentor(
    @Query('classId') classId: string,
    @Query('mentorUserId') mentorUserId: string,
  ): Promise<ClassMentorPriceWithMentorResponseDto | null> {
    const result = await this.classMentorPriceQueryService.findOne({ classId, mentorUserId });
    return result ? this.mapClassMentorPriceWithMentorToDto(result) : null;
  }

  @Put("class-mentor-prices/:id")
  @ApiOperation({
    summary: "Update class mentor price",
    description:
      "Updates class mentor price fields (e.g., pricePerSession). [更新班级导师价格字段，如pricePerSession]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Class mentor price ID (UUID). [班级导师价格ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: UpdateClassMentorPriceRequestDto })
  @ApiOkResponse({
    description: "Class mentor price updated successfully",
    type: ClassMentorPriceResponseDto,
  })
  @ApiResponse({ status: 404, description: "Class mentor price not found" })
  async updateClassMentorPrice(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() body: UpdateClassMentorPriceRequestDto,
  ): Promise<ClassMentorPriceResponseDto> {
    const dto: UpdateClassMentorPriceDto =
      body as unknown as UpdateClassMentorPriceDto;
    const price = await this.updateClassMentorPriceCommand.execute({
      id,
      dto,
      updatedBy: String((user as unknown as { id: string }).id),
    });
    return this.mapClassMentorPriceToDto(price);
  }

  @Patch("class-mentor-prices/:id/status")
  @ApiOperation({
    summary: "Update class mentor price status",
    description:
      "Updates status of class mentor price record. [更新班级导师价格记录状态]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Class mentor price ID (UUID). [班级导师价格ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: UpdateClassMentorPriceStatusRequestDto })
  @ApiOkResponse({
    description: "Class mentor price status updated successfully",
    type: ClassMentorPriceResponseDto,
  })
  @ApiResponse({ status: 404, description: "Class mentor price not found" })
  async updateClassMentorPriceStatus(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() body: UpdateClassMentorPriceStatusRequestDto,
  ): Promise<ClassMentorPriceResponseDto> {
    const dto: UpdateClassMentorPriceStatusDto =
      body as unknown as UpdateClassMentorPriceStatusDto;
    const price = await this.updateClassMentorPriceStatusCommand.execute({
      id,
      status: dto.status,
      updatedBy: String((user as unknown as { id: string }).id),
    });
    return this.mapClassMentorPriceToDto(price);
  }

  // ----------------------
  // 应付账款管理
  // ----------------------

  @Post("payable-ledgers/:id/adjust")
  @ApiOperation({
    summary: "Adjust payable ledger",
    description:
      "Creates an adjustment record for a payable ledger. [为应付账款创建调整记录]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Payable ledger ID (UUID). [应付账款ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: AdjustPayableLedgerRequestDto })
  @ApiOkResponse({ description: "Payable ledger adjusted successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async adjustPayableLedger(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() body: AdjustPayableLedgerRequestDto,
  ): Promise<void> {
    const dto: AdjustPayableLedgerDto = {
      ledgerId: id,
      adjustmentAmount: body.adjustmentAmount,
      reason: body.reason,
      createdBy: String((user as unknown as { id: string }).id),
      metadata: body.metadata,
    };
    return this.adjustPayableLedgerCommand.execute(dto);
  }

  // ----------------------
  // 支付参数管理
  // ----------------------

  @Put("payment-params/:currency/:settlementMonth")
  @ApiOperation({
    summary: "Create or update payment parameters",
    description:
      "Creates or updates default payment parameters for a currency and settlement month. [为币种+结算月份创建或更新默认支付参数]",
  })
  @ApiParam({
    name: "currency",
    required: true,
    description: "Currency code (ISO 4217). [币种码(ISO 4217)]",
    type: String,
  })
  @ApiParam({
    name: "settlementMonth",
    required: true,
    description: "Settlement month (YYYY-MM). [结算月份(YYYY-MM)]",
    type: String,
  })
  @ApiBody({ type: PaymentParamUpdateRequestDto })
  @ApiOkResponse({ description: "Payment parameters updated successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async updateOrCreatePaymentParams(
    @CurrentUser() user: IJwtUser,
    @Param("currency") currency: string,
    @Param("settlementMonth") settlementMonth: string,
    @Body() body: PaymentParamUpdateRequestDto,
  ): Promise<void> {
    const params: IPaymentParamUpdate = body as unknown as IPaymentParamUpdate;
    return this.updateOrCreatePaymentParamsCommand.execute({
      currency,
      settlementMonth,
      params,
      createdBy: String((user as unknown as { id: string }).id),
    });
  }

  @Patch("payment-params/:currency/:settlementMonth")
  @ApiOperation({
    summary: "Modify payment parameters",
    description:
      "Partially modifies default payment parameters. [部分更新默认支付参数]",
  })
  @ApiParam({
    name: "currency",
    required: true,
    description: "Currency code (ISO 4217). [币种码(ISO 4217)]",
    type: String,
  })
  @ApiParam({
    name: "settlementMonth",
    required: true,
    description: "Settlement month (YYYY-MM). [结算月份(YYYY-MM)]",
    type: String,
  })
  @ApiBody({ type: ModifyPaymentParamsRequestDto })
  @ApiOkResponse({ description: "Payment parameters modified successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  async modifyPaymentParams(
    @CurrentUser() user: IJwtUser,
    @Param("currency") currency: string,
    @Param("settlementMonth") settlementMonth: string,
    @Body() body: ModifyPaymentParamsRequestDto,
  ): Promise<void> {
    const params: Partial<IPaymentParamUpdate> =
      body as unknown as Partial<IPaymentParamUpdate>;
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
  @ApiOperation({
    summary: "Create or update mentor payment info",
    description:
      "Creates or updates mentor payment info. paymentDetails is polymorphic by paymentMethod. [创建或更新导师支付信息，paymentDetails 随 paymentMethod 多态变化]",
  })
  @ApiBody({ type: CreateOrUpdateMentorPaymentInfoRequestDto })
  @ApiOkResponse({
    description: "Mentor payment info updated successfully",
    type: MentorPaymentInfoResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async createOrUpdateMentorPaymentInfo(
    @Body() body: CreateOrUpdateMentorPaymentInfoRequestDto,
  ): Promise<MentorPaymentInfoResponseDto> {
    const request: ICreateOrUpdateMentorPaymentInfoRequest =
      body as unknown as ICreateOrUpdateMentorPaymentInfoRequest;
    const paymentInfo = await this.createOrUpdateMentorPaymentInfoCommand.execute(request);
    return this.mapMentorPaymentInfoToDto({
      ...paymentInfo,
      paymentMethod: paymentInfo.paymentMethod as SettlementMethod,
      paymentDetails: paymentInfo.paymentDetails as Record<string, unknown>,
    });
  }

  @Patch("mentor-payment-infos/:id/status")
  @ApiOperation({
    summary: "Update mentor payment info status",
    description:
      "Updates status of a mentor payment info record. [更新导师支付信息记录状态]",
  })
  @ApiParam({
    name: "id",
    required: true,
    description: "Payment info ID (UUID). [支付信息ID(UUID)]",
    type: String,
  })
  @ApiBody({ type: UpdateMentorPaymentInfoStatusRequestDto })
  @ApiOkResponse({
    description: "Mentor payment info status updated successfully",
    type: MentorPaymentInfoResponseDto,
  })
  @ApiResponse({ status: 404, description: "Mentor payment info not found" })
  async updateMentorPaymentInfoStatus(
    @CurrentUser() user: IJwtUser,
    @Param("id") id: string,
    @Body() body: UpdateMentorPaymentInfoStatusRequestDto,
  ): Promise<MentorPaymentInfoResponseDto> {
    const paymentInfo = await this.updateMentorPaymentInfoStatusCommand.execute({
      id,
      status: body.status,
      updatedBy: String((user as unknown as { id: string }).id),
    });
    return this.mapMentorPaymentInfoToDto({
      ...paymentInfo,
      paymentMethod: paymentInfo.paymentMethod as SettlementMethod,
      paymentDetails: paymentInfo.paymentDetails as Record<string, unknown>,
    });
  }
}
