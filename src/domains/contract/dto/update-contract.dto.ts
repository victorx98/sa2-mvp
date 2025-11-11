import { IsOptional, IsString, IsDateString } from "class-validator";

/**
 * DTO for updating contract (更新合约的DTO)
 * Used when updating contract fields (用于更新合约字段)
 */
export class UpdateContractDto {
  @IsOptional()
  @IsString()
  overrideAmount?: string; // Price override amount (价格覆盖金额)

  @IsOptional()
  @IsString()
  overrideReason?: string; // Reason for price override (价格覆盖原因)

  @IsOptional()
  @IsString()
  overrideApprovedBy?: string; // Approver of price override (价格覆盖批准人)

  @IsOptional()
  @IsDateString()
  suspendedAt?: Date; // Contract suspension date (合约暂停日期)

  @IsOptional()
  @IsString()
  suspendedReason?: string; // Reason for suspension (暂停原因)

  @IsOptional()
  @IsDateString()
  resumedAt?: Date; // Contract resumption date (合约恢复日期)

  @IsOptional()
  @IsDateString()
  terminatedAt?: Date; // Contract termination date (合约终止日期)

  @IsOptional()
  @IsString()
  terminatedReason?: string; // Reason for termination (终止原因)

  @IsOptional()
  @IsDateString()
  completedAt?: Date; // Contract completion date (合约完成日期)

  @IsOptional()
  @IsString()
  updatedBy?: string; // Updater ID (更新人ID)
}
