import { IsOptional, IsString, IsDateString } from "class-validator";

/**
 * Update Contract DTO
 * Used when updating contract fields
 */
export class UpdateContractDto {
  @IsOptional()
  @IsString()
  overrideAmount?: string;

  @IsOptional()
  @IsString()
  overrideReason?: string;

  @IsOptional()
  @IsString()
  overrideApprovedBy?: string;

  @IsOptional()
  @IsDateString()
  suspendedAt?: Date;

  @IsOptional()
  @IsString()
  suspendedReason?: string;

  @IsOptional()
  @IsDateString()
  resumedAt?: Date;

  @IsOptional()
  @IsDateString()
  terminatedAt?: Date;

  @IsOptional()
  @IsString()
  terminatedReason?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: Date;

  @IsOptional()
  @IsString()
  updatedBy?: string;
}
