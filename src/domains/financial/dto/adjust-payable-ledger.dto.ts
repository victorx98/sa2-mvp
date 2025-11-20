/**
 * Adjust Payable Ledger DTO[调整应付分类账DTO]
 *
 * This DTO defines the data structure for adjusting payable ledger records[此DTO定义了调整应付分类账记录的数据结构]
 */

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsOptional,
} from "class-validator";

export class AdjustPayableLedgerDto {
  @IsUUID()
  @IsNotEmpty()
  ledgerId: string; // Ledger ID to adjust[要调整的分类账ID]

  @IsNumber()
  @IsNotEmpty()
  adjustmentAmount: number; // Adjustment amount (positive for increase, negative for decrease)[调整金额（正数为增加，负数为减少）]

  @IsString()
  @IsNotEmpty()
  reason: string; // Reason for adjustment[调整原因]

  @IsUUID()
  @IsNotEmpty()
  createdBy: string; // User ID who made the adjustment[创建调整的用户ID]

  @IsOptional()
  metadata?: Record<string, unknown>; // Additional metadata[额外元数据]
}
