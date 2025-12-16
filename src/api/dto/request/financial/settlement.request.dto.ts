import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Min } from "class-validator";

export class CreateSettlementRequestDto {
  @ApiProperty({
    description:
      "Mentor ID (UUID). Settlement is generated per mentor and month. [导师ID(UUID)，按导师+月份生成结算]",
    type: String,
    format: "uuid",
    required: true,
  })
  @IsUUID()
  @IsNotEmpty()
  mentorId!: string;

  @ApiProperty({
    description:
      "Settlement month in YYYY-MM format. [结算月份(YYYY-MM)]",
    type: String,
    required: true,
    example: "2025-11",
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}$/, {
    message: "settlementMonth must be in YYYY-MM format [settlementMonth必须是YYYY-MM格式]",
  })
  settlementMonth!: string;

  @ApiProperty({
    description:
      "Exchange rate used for currency conversion. [汇率，用于币种转换]",
    type: Number,
    required: true,
    example: 7.2,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  exchangeRate!: number;

  @ApiProperty({
    description:
      "Deduction rate (e.g., 0.0500 for 5%). [扣除比率，如0.0500表示5%]",
    type: Number,
    required: true,
    example: 0.05,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  deductionRate!: number;
}

export class PaymentParamUpdateRequestDto {
  @ApiProperty({
    description: "Default exchange rate. [默认汇率]",
    type: Number,
    required: true,
    example: 7.2,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  defaultExchangeRate!: number;

  @ApiProperty({
    description: "Default deduction rate. [默认扣除比率]",
    type: Number,
    required: true,
    example: 0.05,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  defaultDeductionRate!: number;
}

export class ModifyPaymentParamsRequestDto {
  @ApiPropertyOptional({
    description: "Default exchange rate (optional). [默认汇率(可选)]",
    type: Number,
    required: false,
    example: 7.2,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultExchangeRate?: number;

  @ApiPropertyOptional({
    description: "Default deduction rate (optional). [默认扣除比率(可选)]",
    type: Number,
    required: false,
    example: 0.05,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultDeductionRate?: number;
}

export class UpdateMentorPaymentInfoStatusRequestDto {
  @ApiProperty({
    description: "New status. [新状态]",
    type: String,
    required: true,
    enum: ["ACTIVE", "INACTIVE"],
    example: "ACTIVE",
  })
  @IsString()
  @IsNotEmpty()
  status!: "ACTIVE" | "INACTIVE";

  @ApiPropertyOptional({
    description:
      "Optional operator note. [操作备注(可选)]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  operatorNote?: string;
}

