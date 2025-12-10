import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsIn,
} from "class-validator";

// Define currency options as an array for validation
const CURRENCY_OPTIONS = ["USD", "CNY", "EUR", "GBP", "JPY"] as const;
type CurrencyType = (typeof CURRENCY_OPTIONS)[number];

/**
 * DTO for updating contract (更新合约的DTO)
 * Used when updating contract fields (用于更新合约字段)
 */
export class UpdateContractDto {
  // Core contract fields (核心合同字段)
  @IsOptional()
  @IsString()
  title?: string; // Contract title (合同标题)

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number; // Contract total amount (合同总金额)

  @IsOptional()
  @IsIn(CURRENCY_OPTIONS)
  currency?: CurrencyType; // Contract currency (合同货币)

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3650) // Maximum 10 years
  validityDays?: number; // Validity period in days (有效期天数)

  // Audit fields (审计字段)
  @IsOptional()
  @IsString()
  updatedBy?: string; // Updater ID (更新人ID)

  @IsOptional()
  @IsString()
  updateReason?: string; // Reason for update (更新原因)
}
