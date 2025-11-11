import { IsOptional, IsString, IsUUID, IsEnum } from "class-validator";

/**
 * DTO for filtering contracts (筛选合约的DTO)
 * Used for filtering contracts in search queries (用于在搜索查询中筛选合约)
 */
export class ContractFilterDto {
  @IsOptional()
  @IsString()
  studentId?: string; // Student ID (学生ID)

  @IsOptional()
  @IsEnum(["signed", "active", "suspended", "completed", "terminated"])
  status?: string; // Contract status (合约状态)

  @IsOptional()
  @IsUUID()
  productId?: string; // Product ID (产品ID)
}
