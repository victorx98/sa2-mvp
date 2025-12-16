import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min } from "class-validator";

export class AdjustPayableLedgerRequestDto {
  @ApiProperty({
    description:
      "Adjustment amount. Positive for increase, negative for decrease. [调整金额：正数增加，负数减少]",
    type: Number,
    required: true,
    example: -50,
  })
  @IsNumber()
  @IsNotEmpty()
  adjustmentAmount!: number;

  @ApiProperty({
    description: "Reason for adjustment. [调整原因]",
    type: String,
    required: true,
    example: "Manual correction after appeal",
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({
    description:
      "Optional metadata for audit/debug. [可选元数据，用于审计/调试]",
    type: Object,
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PaymentParamsUpdateRequestDto {
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

