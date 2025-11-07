import { IsOptional, IsUUID, IsString, IsEnum } from "class-validator";

/**
 * Find One Contract DTO
 * Supports multiple query methods:
 * 1. By contractId (highest priority)
 * 2. By contractNumber (second priority)
 * 3. By combination (studentId + status/productId)
 */
export class FindOneContractDto {
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsString()
  contractNumber?: string;

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
