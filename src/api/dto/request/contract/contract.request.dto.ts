import {
  ApiProperty,
  ApiPropertyOptional,
} from "@nestjs/swagger";
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ContractStatus, AmendmentLedgerType } from "@shared/types/contract-enums";

const CONTRACT_CURRENCY_OPTIONS = ["USD", "CNY", "EUR", "GBP", "JPY"] as const;
type ContractCurrency = (typeof CONTRACT_CURRENCY_OPTIONS)[number];

class ContractProductSnapshotItemRequestDto {
  @ApiProperty({
    description:
      "Product item ID (UUID). Used for traceability of entitlement origin. [产品项ID(UUID)，用于权益来源追溯]",
    type: String,
    format: "uuid",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsString()
  productItemId!: string;

  @ApiProperty({
    description:
      "Service type code from catalog snapshot. Used for entitlement aggregation. [服务类型编码，用于权益汇总]",
    type: String,
    required: true,
    example: "resume_review",
  })
  @IsNotEmpty()
  @IsString()
  serviceTypeCode!: string;

  @ApiProperty({
    description: "Quantity in this product item. Must be >= 1. [该产品项包含次数，必须>=1]",
    type: Number,
    required: true,
    example: 4,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty({
    description: "Sort order in snapshot. Must be >= 0. [快照内排序，必须>=0]",
    type: Number,
    required: true,
    example: 0,
    minimum: 0,
  })
  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

class ContractProductSnapshotRequestDto {
  @ApiProperty({
    description:
      "Product ID (UUID). Identifies the purchased product at purchase time. [产品ID(UUID)，标识购买的产品]",
    type: String,
    format: "uuid",
    required: true,
  })
  @IsNotEmpty()
  @IsUUID()
  productId!: string;

  @ApiProperty({
    description: "Product name at purchase time. [购买时的产品名称(快照)]",
    type: String,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  productName!: string;

  @ApiProperty({
    description: "Product code at purchase time. [购买时的产品编码(快照)]",
    type: String,
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  productCode!: string;

  @ApiProperty({
    description:
      "Product price at purchase time as decimal string. [购买时的产品价格(字符串)]",
    type: String,
    required: true,
    example: "1999.00",
  })
  @IsNotEmpty()
  @IsString()
  price!: string;

  @ApiProperty({
    description:
      "Currency at purchase time (ISO 4217 3-letter code). [购买时币种(ISO 4217 三位码)]",
    type: String,
    required: true,
    example: "USD",
  })
  @IsNotEmpty()
  @IsString()
  currency!: string;

  @ApiPropertyOptional({
    description:
      "Validity period days (optional). Used when product has time-based validity. [有效期天数(可选)，用于按天有效期的产品]",
    type: Number,
    required: false,
    example: 365,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays?: number;

  @ApiProperty({
    description:
      "Snapshot items representing entitlement composition. [权益组成快照项列表]",
    type: () => ContractProductSnapshotItemRequestDto,
    isArray: true,
    required: true,
  })
  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractProductSnapshotItemRequestDto)
  items!: ContractProductSnapshotItemRequestDto[];

  @ApiProperty({
    description: "Snapshot time (ISO 8601). [快照时间(ISO 8601)]",
    type: String,
    format: "date-time",
    required: true,
    example: "2025-12-01T00:00:00.000Z",
  })
  @IsNotEmpty()
  @IsString()
  snapshotAt!: string;
}

export class CreateContractRequestDto {
  @ApiProperty({
    description:
      "Student ID (UUID). Contract owner. [学生ID(UUID)，合同所属学生]",
    type: String,
    required: true,
    format: "uuid",
  })
  @IsNotEmpty()
  @IsString()
  studentId!: string;

  @ApiProperty({
    description:
      "Product ID (UUID). Reference to catalog product (ACL: UUID string only). [产品ID(UUID)，目录域产品引用(防腐层：仅UUID字符串)]",
    type: String,
    required: true,
    format: "uuid",
  })
  @IsNotEmpty()
  @IsUUID()
  productId!: string;

  @ApiProperty({
    description:
      "Frozen product snapshot captured at purchase time. Used to keep contract immutable. [产品快照(购买时冻结)，用于保持合同不可变]",
    type: () => ContractProductSnapshotRequestDto,
    required: true,
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ContractProductSnapshotRequestDto)
  productSnapshot!: ContractProductSnapshotRequestDto;

  @ApiPropertyOptional({
    description:
      "Initial contract status. Default: DRAFT. Only DRAFT or SIGNED is allowed at creation. [初始状态，默认DRAFT；创建时仅允许DRAFT或SIGNED]",
    enum: ContractStatus,
    required: false,
    default: ContractStatus.DRAFT,
    example: ContractStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({
    description: "Contract title (optional). [合同标题(可选)]",
    type: String,
    required: false,
    example: "Premium Mentoring Contract",
  })
  @IsOptional()
  @IsString()
  title?: string;
}

export class UpdateContractRequestDto {
  @ApiPropertyOptional({
    description: "Contract title. [合同标题]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description:
      "Contract total amount (override). Must be >= 0. [合同总金额(覆盖)，必须>=0]",
    type: Number,
    required: false,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

  @ApiPropertyOptional({
    description:
      "Contract currency. Allowed values: USD/CNY/EUR/GBP/JPY. [合同币种，仅允许USD/CNY/EUR/GBP/JPY]",
    type: String,
    required: false,
    enum: CONTRACT_CURRENCY_OPTIONS,
    example: "USD",
  })
  @IsOptional()
  @IsIn(CONTRACT_CURRENCY_OPTIONS)
  currency?: ContractCurrency;

  @ApiPropertyOptional({
    description:
      "Validity period in days. 1~3650. [有效期天数，范围1~3650]",
    type: Number,
    required: false,
    minimum: 1,
    maximum: 3650,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650)
  validityDays?: number;

  @ApiPropertyOptional({
    description:
      "Updater user ID (UUID). Ignored if set by server-side context. [更新人用户ID(UUID)，若服务端从上下文设置则忽略]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsString()
  updatedBy?: string;

  @ApiPropertyOptional({
    description: "Update reason (optional). [更新原因(可选)]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  updateReason?: string;
}

export class UpdateContractStatusRequestDto {
  @ApiProperty({
    description: "Target contract status. [目标合同状态]",
    enum: ContractStatus,
    required: true,
    example: ContractStatus.ACTIVE,
  })
  @IsEnum(ContractStatus)
  status!: ContractStatus;

  @ApiPropertyOptional({
    description:
      "Reason for status change. Required for suspend/terminate. [状态变更原因：暂停/终止时必填]",
    type: String,
    required: false,
    example: "Payment issue",
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description:
      "Signer user ID (UUID). When omitted, server uses current user from JWT. [签署人用户ID(UUID)，不传则使用JWT当前用户]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsString()
  signedBy?: string;
}

export class ConsumeServiceRequestDto {
  @ApiProperty({
    description:
      "Student ID (UUID). Used to locate entitlement record. [学生ID(UUID)，用于定位权益记录]",
    type: String,
    required: true,
    format: "uuid",
  })
  @IsNotEmpty()
  @IsString()
  studentId!: string;

  @ApiPropertyOptional({
    description:
      "Contract ID (UUID, optional). For audit only. [合同ID(UUID，可选)，仅用于审计]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiProperty({
    description:
      "Service type code to consume (e.g., resume_review). [要消费的服务类型编码]",
    type: String,
    required: true,
    example: "resume_review",
  })
  @IsNotEmpty()
  @IsString()
  serviceType!: string;

  @ApiProperty({
    description:
      "Quantity to consume. Must be a positive number. [消费数量，必须为正数]",
    type: Number,
    required: true,
    example: 1,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsPositive()
  quantity!: number;

  @ApiPropertyOptional({
    description:
      "Related booking ID (UUID). Used to link consumption to a booking/session. [关联预约ID(UUID)，用于关联会话/预约]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  relatedBookingId?: string;

  @ApiPropertyOptional({
    description:
      "Related hold ID (UUID). Used to link consumption to a hold record. [关联预占ID(UUID)，用于关联预占记录]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  relatedHoldId?: string;

  @ApiPropertyOptional({
    description:
      "Booking source table name. Required when relatedBookingId is provided. [预约来源表名，relatedBookingId 存在时必填]",
    type: String,
    required: false,
    example: "regular_mentoring_sessions",
  })
  @ValidateIf(
    (o: ConsumeServiceRequestDto) =>
      o.relatedBookingId !== undefined && o.relatedBookingId !== null,
  )
  @IsNotEmpty({
    message:
      "bookingSource is required when relatedBookingId is provided [relatedBookingId存在时bookingSource必填]",
  })
  @IsString()
  bookingSource?: string;
}

export class AddAmendmentLedgerRequestDto {
  @ApiProperty({
    description:
      "Student ID (UUID). Entitlements are maintained at student level. [学生ID(UUID)，权益按学生维度维护]",
    type: String,
    required: true,
    format: "uuid",
  })
  @IsNotEmpty()
  @IsString()
  studentId!: string;

  @ApiPropertyOptional({
    description:
      "Contract ID (UUID, optional). For reference only. [合同ID(UUID，可选)，仅作参考]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @ApiProperty({
    description:
      "Service type code to adjust. [要调整的服务类型编码]",
    type: String,
    required: true,
    example: "resume_review",
  })
  @IsNotEmpty()
  @IsString()
  serviceType!: string;

  @ApiProperty({
    description:
      "Amendment ledger type. Explains why entitlements change. [台账类型，说明权益变更来源]",
    enum: AmendmentLedgerType,
    required: true,
    example: AmendmentLedgerType.ADDON,
  })
  @IsNotEmpty()
  @IsEnum(AmendmentLedgerType)
  ledgerType!: AmendmentLedgerType;

  @ApiProperty({
    description:
      "Quantity change. Must be positive. [变更数量，必须为正数]",
    type: Number,
    required: true,
    example: 1,
    minimum: 1,
  })
  @IsNotEmpty()
  @IsPositive()
  quantityChanged!: number;

  @ApiProperty({
    description:
      "Reason for amendment. [调整原因]",
    type: String,
    required: true,
    example: "Promotion compensation",
  })
  @IsNotEmpty()
  @IsString()
  reason!: string;

  @ApiPropertyOptional({
    description: "Optional detailed description. [可选详细说明]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      "Optional attachment URLs. [可选附件URL列表]",
    type: [String],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @ApiPropertyOptional({
    description: "Related booking ID (UUID). [关联预约ID(UUID)]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  relatedBookingId?: string;

  @ApiPropertyOptional({
    description:
      "Booking source table name. Required when relatedBookingId is provided. [预约来源表名，relatedBookingId存在时必填]",
    type: String,
    required: false,
    example: "regular_mentoring_sessions",
  })
  @ValidateIf(
    (o: AddAmendmentLedgerRequestDto) =>
      o.relatedBookingId !== undefined && o.relatedBookingId !== null,
  )
  @IsNotEmpty({
    message:
      "bookingSource is required when relatedBookingId is provided [relatedBookingId存在时bookingSource必填]",
  })
  @IsString()
  bookingSource?: string;

  @ApiProperty({
    description:
      "Created by user ID (UUID). Required. [创建人用户ID(UUID)，必填]",
    type: String,
    required: true,
    format: "uuid",
  })
  @IsNotEmpty()
  @IsString()
  createdBy!: string;
}

export class ServiceTypeConsumptionQueryDto {
  @ApiPropertyOptional({
    description: "Student ID (UUID) for filtering. [用于筛选的学生ID(UUID)]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({
    description: "Mentor ID (UUID) for filtering. [用于筛选的导师ID(UUID)]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  mentorId?: string;

  @ApiPropertyOptional({
    description: "Status for filtering. [用于筛选的状态]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: "Page number. Default: 1. [页码，默认值：1]",
    type: Number,
    required: false,
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: "Page size. Default: 20. Max: 100. [每页条数，默认值：20，最大值：100]",
    type: Number,
    required: false,
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number;

  @ApiPropertyOptional({
    description: "Sort field. Default: startDate. [排序字段，默认值：startDate]",
    type: String,
    required: false,
    example: "startDate",
  })
  @IsOptional()
  @IsString()
  sortField?: string;

  @ApiPropertyOptional({
    description: "Sort order. Default: desc. [排序方向，默认值：desc]",
    enum: ["asc", "desc"],
    required: false,
    example: "desc",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc";
}


// Type aliases for backward compatibility
export type CreateContractDto = CreateContractRequestDto;
export type UpdateContractDto = UpdateContractRequestDto;
export type UpdateContractStatusDto = UpdateContractStatusRequestDto;
export type ConsumeServiceDto = ConsumeServiceRequestDto;
export type AddAmendmentLedgerDto = AddAmendmentLedgerRequestDto;
