import { IsOptional, IsString, IsUUID, IsEnum } from "class-validator";

/**
 * Contract Filter DTO
 * Used for filtering contracts in search queries
 */
export class ContractFilterDto {
  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsEnum(["signed", "active", "suspended", "completed", "terminated"])
  status?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;
}
