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
import { ListMentorPricesQuery } from "@application/queries/financial/list-mentor-prices.query";
import { ListMentorAppealsQuery } from "@application/queries/financial/list-mentor-appeals.query";

import type { CreateMentorAppealRequestDto as CreateAppealDto } from "@api/dto/request/financial/mentor-appeal.request.dto";
import type { ApproveMentorAppealRequestDto as ApproveAppealDto } from "@api/dto/request/financial/mentor-appeal.request.dto";
import type { RejectMentorAppealRequestDto as RejectAppealDto } from "@api/dto/request/financial/mentor-appeal.request.dto";
import type { CreateMentorPriceRequestDto as CreateMentorPriceDto } from "@api/dto/request/financial/mentor-price.request.dto";
import type { UpdateMentorPriceRequestDto as UpdateMentorPriceDto } from "@api/dto/request/financial/mentor-price.request.dto";
import type { UpdateMentorPriceStatusRequestDto as UpdateMentorPriceStatusDto } from "@api/dto/request/financial/mentor-price.request.dto";
import { ListMentorPricesQueryDto } from "@api/dto/request/financial/mentor-price.request.dto";
import { ListMentorAppealsQueryDto } from "@api/dto/request/financial/list-mentor-appeals.request.dto";

import type { AdjustPayableLedgerRequestDto as AdjustPayableLedgerDto } from "@api/dto/request/financial/payable-ledger.request.dto";
import type { ICreateSettlementRequest, IPaymentParamUpdate } from "@api/dto/request/financial/settlement.request.dto";
import type { ICreateOrUpdateMentorPaymentInfoRequest } from "@api/dto/request/financial/mentor-payment-info.request.dto";

import {
  ApproveMentorAppealRequestDto,
  CreateMentorAppealRequestDto,
  RejectMentorAppealRequestDto,
} from "@api/dto/request/financial/mentor-appeal.request.dto";
import {
  MentorAppealResponseDto,
  MentorAppealWithRelationsResponseDto,
  PaginatedMentorAppealResponseDto,
} from "@api/dto/response/financial/mentor-appeal.response.dto";
import {
  BulkCreateMentorPriceRequestDto,
  BulkUpdateMentorPriceRequestDto,
  CreateMentorPriceRequestDto,
  UpdateMentorPriceRequestDto,
  UpdateMentorPriceStatusRequestDto,
} from "@api/dto/request/financial/mentor-price.request.dto";
import {
  MentorPriceResponseDto,
  MentorPriceWithMentorResponseDto,
  PaginatedMentorPriceResponseDto,
} from "@api/dto/response/financial/mentor-price.response.dto";
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
  ChannelBatchPayPaymentDetailsDto,
  CheckPaymentDetailsDto,
  DomesticTransferPaymentDetailsDto,
  GustoInternationalPaymentDetailsDto,
  GustoPaymentDetailsDto,
} from "@api/dto/request/financial/payment-details.dto";
import { SettlementMethod } from "@api/dto/request/financial/settlement.request.dto";
import type { MentorPrice } from "@infrastructure/database/schema";

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

    // 查询相关
    private readonly listMentorPricesQuery: ListMentorPricesQuery,
    private readonly listMentorAppealsQuery: ListMentorAppealsQuery,
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
      createdAt: (price.createdAt as any) instanceof Date
        ? (price.createdAt as Date).toISOString()
        : String(price.createdAt),
      updatedAt: (price.updatedAt as any) instanceof Date
        ? (price.updatedAt as Date).toISOString()
        : String(price.updatedAt),
    };
  }



  private mapMentorPaymentInfoToDto(paymentInfo: {
    id: string;
    mentorId: string;
    paymentCurrency: string;
    paymentMethod: SettlementMethod;
    paymentDetails: MentorPaymentInfoResponseDto["paymentDetails"];
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
      paymentDetails: paymentInfo.paymentDetails,
      status: paymentInfo.status,
      createdAt:
        paymentInfo.createdAt instanceof Date
          ? paymentInfo.createdAt.toISOString()
          : paymentInfo.createdAt,
      updatedAt:
        paymentInfo.updatedAt instanceof Date
          ? paymentInfo.updatedAt.toISOString()
          : paymentInfo.updatedAt,
      updatedBy: paymentInfo.updatedBy ?? null,
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

  @Get("mentor-appeals")
  @ApiOperation({
    summary: "List mentor appeals",
    description:
      "Lists mentor appeals with pagination, sorting, and filtering. [分页查询导师申诉列表，支持排序和筛选]",
  })
  @ApiOkResponse({
    description: "Mentor appeals retrieved successfully",
    type: PaginatedMentorAppealResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async listMentorAppeals(
    @Query() query: ListMentorAppealsQueryDto,
  ): Promise<PaginatedMentorAppealResponseDto> {
    const result = await this.listMentorAppealsQuery.execute(query);

    // 映射结果到响应 DTO [Map results to response DTO]
    const data: MentorAppealWithRelationsResponseDto[] = result.data.map((item) => ({
      id: item.id,
      title: item.title ?? "",
      appealType: item.appealType,
      appealAmount: item.appealAmount,
      currency: item.currency,
      status: item.status,
      paymentMonth: item.paymentMonth,
      counselor: {
        id: item.counselorId,
        name_cn: item.counselorNameCn ?? "",
        name_en: item.counselorNameEn ?? "",
      },
      mentor: {
        id: item.mentorId,
        name_cn: item.mentorNameCn ?? "",
        name_en: item.mentorNameEn ?? "",
      },
      student: item.studentId
        ? {
            id: item.studentId,
            name_cn: item.studentNameCn ?? "",
            name_en: item.studentNameEn ?? "",
          }
        : null,
      createdAt: item.createdAt instanceof Date
        ? item.createdAt.toISOString()
        : String(item.createdAt),
      approvedAt: item.approvedAt
        ? item.approvedAt instanceof Date
          ? item.approvedAt.toISOString()
          : String(item.approvedAt)
        : undefined,
      rejectedAt: item.rejectedAt
        ? item.rejectedAt instanceof Date
          ? item.rejectedAt.toISOString()
          : String(item.rejectedAt)
        : undefined,
      rejectionReason: item.rejectionReason ?? undefined,
      updatedByName: item.updatedByName,
      updatedAt: item.updatedAt instanceof Date
        ? item.updatedAt.toISOString()
        : String(item.updatedAt),
    }));

    return {
      data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  @Post("mentor-appeals")
  @ApiOperation({
    summary: "Create a new mentor appeal",
    description:
      "Creates a mentor appeal record. IMPORTANT: mentorId is automatically extracted from JWT token and should NOT be included in the request body. [创建导师申诉记录。重要：mentorId从JWT token自动提取，不应包含在请求体中]",
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
    // Extract mentorId from JWT token (not from request body) for security
    // [从JWT token提取mentorId（不是从请求体），确保安全性]
    const userId = String((user as unknown as { id: string }).id);
    
    const appeal = await this.createMentorAppealCommand.execute({
      ...body,
      mentorId: userId, // Always use userId from JWT, never from request body [始终使用JWT中的userId，绝不使用请求体中的]
      createdBy: userId,
    });
    
    return {
      ...appeal,
      approvedAt: (appeal.approvedAt as any) instanceof Date
        ? (appeal.approvedAt as Date).toISOString()
        : appeal.approvedAt ? String(appeal.approvedAt) : undefined,
      rejectedAt: (appeal.rejectedAt as any) instanceof Date
        ? (appeal.rejectedAt as Date).toISOString()
        : appeal.rejectedAt ? String(appeal.rejectedAt) : undefined,
      createdAt: (appeal.createdAt as any) instanceof Date
        ? (appeal.createdAt as Date).toISOString()
        : String(appeal.createdAt),
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
      approvedAt: (appeal.approvedAt as any) instanceof Date
        ? (appeal.approvedAt as Date).toISOString()
        : appeal.approvedAt ? String(appeal.approvedAt) : undefined,
      rejectedAt: (appeal.rejectedAt as any) instanceof Date
        ? (appeal.rejectedAt as Date).toISOString()
        : appeal.rejectedAt ? String(appeal.rejectedAt) : undefined,
      createdAt: (appeal.createdAt as any) instanceof Date
        ? (appeal.createdAt as Date).toISOString()
        : String(appeal.createdAt),
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
      approvedAt: (appeal.approvedAt as any) instanceof Date
        ? (appeal.approvedAt as Date).toISOString()
        : appeal.approvedAt ? String(appeal.approvedAt) : undefined,
      rejectedAt: (appeal.rejectedAt as any) instanceof Date
        ? (appeal.rejectedAt as Date).toISOString()
        : appeal.rejectedAt ? String(appeal.rejectedAt) : undefined,
      createdAt: (appeal.createdAt as any) instanceof Date
        ? (appeal.createdAt as Date).toISOString()
        : String(appeal.createdAt),
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
      createdAt: (settlement.createdAt as any) instanceof Date
        ? new Date(settlement.createdAt).toISOString()
        : String(settlement.createdAt),
    };
  }

  // ----------------------
  // 导师价格管理
  // ----------------------

  @Get("mentor-prices")
  @ApiOperation({
    summary: "List mentor prices with pagination",
    description:
      "Lists mentor prices with pagination, sorting, and mentor information. [分页查询导师价格列表，支持排序和导师信息]",
  })
  @ApiOkResponse({
    description: "Mentor prices retrieved successfully",
    type: PaginatedMentorPriceResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  async listMentorPrices(
    @Query() query: ListMentorPricesQueryDto,
  ): Promise<PaginatedMentorPriceResponseDto> {
    const result = await this.listMentorPricesQuery.execute(query);

    // 映射结果到响应 DTO [Map results to response DTO]
    const data: MentorPriceWithMentorResponseDto[] = result.data.map((item) => ({
      id: item.id,
      mentorUserId: item.mentorUserId,
      serviceTypeId: item.serviceTypeId,
      sessionTypeCode: item.sessionTypeCode,
      packageCode: item.packageCode,
      price: item.price,
      currency: item.currency,
      status: item.status,
      updatedBy: item.updatedBy,
      createdAt: item.createdAt instanceof Date
        ? item.createdAt.toISOString()
        : String(item.createdAt),
      updatedAt: item.updatedAt instanceof Date
        ? item.updatedAt.toISOString()
        : String(item.updatedAt),
      mentor: {
        mentorId: item.mentorId,
        name_cn: item.name_cn,
        name_en: item.name_en,
      },
    }));

    return {
      data,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

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
    // Assemble complete DTO with ledgerId from URL parameter [组装完整的DTO，包含来自URL参数的ledgerId]
    // createdBy is extracted from JWT token, not from request body [createdBy从JWT token提取，不是从请求体]
    const dto: AdjustPayableLedgerRequestDto = {
      ...body, // Keep all fields from request body [保留请求体中的所有字段]
      ledgerId: id, // Override with URL parameter [用URL参数覆盖]
    };
    const createdBy = String((user as unknown as { id: string }).id);

    return this.adjustPayableLedgerCommand.execute(dto, createdBy);
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
    });
  }
}
