import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Min, IsUUID } from "class-validator";

/**
 * Request DTO for adjusting payable ledger [用于调整应付账款的请求DTO]
 *
 * This DTO contains all fields required for adjusting a payable ledger record,
 * whether they come from URL parameters, request body, or server-generated values.
 * 此DTO包含调整应付账款记录所需的所有字段，无论这些字段来自URL参数、请求体还是服务端生成的值。
 */
export class AdjustPayableLedgerRequestDto {
  @ApiProperty({
    description: "Payable ledger ID (UUID) [应付账款ID(UUID)]",
    type: String,
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID("4", { message: "ledgerId must be a valid UUID [ledgerId必须是有效的UUID]" })
  ledgerId!: string; // Unique identifier of the payable ledger record [应付账款记录的唯一标识符]

  @ApiProperty({
    description:
      "Adjustment amount. Positive for increase, negative for decrease. [调整金额：正数增加，负数减少]",
    type: Number,
    required: true,
    example: -50,
  })
  @IsNumber()
  @IsNotEmpty()
  adjustmentAmount!: number; // Amount to adjust (positive for increase, negative for decrease) [调整金额（正数增加，负数减少）]

  @ApiProperty({
    description: "Reason for adjustment. [调整原因]",
    type: String,
    required: true,
    example: "Manual correction after appeal",
  })
  @IsString()
  @IsNotEmpty()
  reason!: string; // Human-readable explanation for the adjustment [调整的人工可读解释]

  @ApiPropertyOptional({
    description:
      "Optional metadata for audit/debug. [可选元数据，用于审计/调试]",
    type: Object,
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>; // Additional context for audit/debug purposes [审计/调试的额外上下文]
}

// Type aliases for backward compatibility
export type AdjustPayableLedgerDto = AdjustPayableLedgerRequestDto;
export type PaymentParamsUpdateDto = PaymentParamsUpdateRequestDto;

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

