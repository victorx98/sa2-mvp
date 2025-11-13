import { IsOptional, IsUUID, IsString, IsDateString } from "class-validator";

/**
 * DTO for filtering ledger records (筛选台账记录的DTO)
 * Used for filtering ledger records (用于筛选台账记录)
 */
export class LedgerFilterDto {
  @IsOptional()
  @IsUUID()
  contractId?: string; // Contract ID (合约ID)

  @IsOptional()
  @IsString()
  studentId?: string; // Student ID (学生ID)

  @IsOptional()
  @IsString()
  serviceType?: string; // Service type (服务类型)

  @IsOptional()
  @IsDateString()
  startDate?: Date; // Filter start date (筛选开始日期)

  @IsOptional()
  @IsDateString()
  endDate?: Date; // Filter end date (筛选结束日期)
}
