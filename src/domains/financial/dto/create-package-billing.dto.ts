/**
 * Create Package Billing DTO[创建服务包计费DTO]
 *
 * This DTO defines the data structure for creating package billing records[此DTO定义了创建服务包计费记录的数据结构]
 */

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsOptional,
} from "class-validator";

export class CreatePackageBillingDto {
  @IsUUID()
  @IsNotEmpty()
  contractId: string; // Contract ID[合同ID]

  @IsUUID()
  @IsNotEmpty()
  servicePackageId: string; // Service package ID[服务包ID]

  @IsUUID()
  @IsNotEmpty()
  mentorUserId: string; // Mentor user ID[导师用户ID]

  @IsUUID()
  @IsNotEmpty()
  studentUserId: string; // Student user ID[学生用户ID]

  @IsString()
  @IsNotEmpty()
  serviceTypeCode: string; // Service type code (references service_types.code field)[服务类型代码（引用service_types.code字段）]

  @IsString()
  @IsOptional()
  serviceName?: string; // Service name[服务名称]

  @IsNumber()
  @IsNotEmpty()
  quantity: number; // Quantity of services[服务数量]

  @IsOptional()
  metadata?: Record<string, unknown>; // Additional metadata[额外元数据]
}
