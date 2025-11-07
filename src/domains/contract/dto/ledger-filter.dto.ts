import { IsOptional, IsUUID, IsString, IsDateString } from "class-validator";

/**
 * Ledger Filter DTO
 * Used for filtering ledger records
 */
export class LedgerFilterDto {
  @IsOptional()
  @IsUUID()
  contractId?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;
}
