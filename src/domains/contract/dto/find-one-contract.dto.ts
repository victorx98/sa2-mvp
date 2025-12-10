import { IsOptional, IsUUID, IsString, IsEnum } from "class-validator";

/**
 * DTO for finding a contract (查找合约的DTO)
 * Supports multiple query methods: (支持多种查询方式)
 * 1. By contractId (highest priority) (通过合约ID(最高优先级))
 * 2. By contractNumber (second priority) (通过合约编号(第二优先级))
 * 3. By combination (studentId + status/productId) (通过组合(学生ID+状态/产品ID))
 */
export class FindOneContractDto {
  @IsOptional()
  @IsUUID()
  contractId?: string; // Contract ID (合约ID)

  @IsOptional()
  @IsString()
  contractNumber?: string; // Contract number (合约编号)

  @IsOptional()
  @IsString()
  studentId?: string; // Student ID (学生ID)

  @IsOptional()
  @IsEnum(["SIGNED", "ACTIVE", "SUSPENDED", "COMPLETED", "TERMINATED"])
  status?: string; // Contract status (合约状态)

  @IsOptional()
  @IsUUID()
  productId?: string; // Product ID (产品ID)
}
