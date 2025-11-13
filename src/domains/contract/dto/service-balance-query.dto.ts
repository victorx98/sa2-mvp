import { IsOptional, IsUUID, IsString } from "class-validator";

/**
 * DTO for querying service balance (查询服务余额的DTO)
 * Used for querying service balance (用于查询服务余额)
 */
export class ServiceBalanceQueryDto {
  @IsOptional()
  @IsUUID()
  contractId?: string; // Contract ID (合约ID)

  @IsOptional()
  @IsString()
  studentId?: string; // Student ID (学生ID)

  @IsOptional()
  @IsString()
  serviceType?: string; // Service type (服务类型)
}
