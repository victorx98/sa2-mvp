/**
 * Create Mentor Price DTO[创建导师价格DTO]
 *
 * This DTO defines the data structure for creating mentor price records[此DTO定义了创建导师价格记录的数据结构]
 */

import { BillingMode, ServiceStatus } from "@shared/types/catalog-enums";
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsOptional,
  IsEnum,
} from "class-validator";

export class CreateMentorPriceDto {
  @IsUUID()
  @IsNotEmpty()
  mentorUserId: string; // Mentor user ID[导师用户ID]

  @IsString()
  @IsNotEmpty()
  serviceTypeCode: string; // Service type code (references service_types.code field)[服务类型代码（引用service_types.code字段）]

  @IsNotEmpty()
  @IsEnum(BillingMode)
  billingMode: BillingMode; // Billing mode[计费模式]

  @IsNumber()
  @IsNotEmpty()
  price: number; // Price per unit[单价]

  @IsString()
  @IsOptional()
  currency?: string; // Currency code (default: USD)[货币代码（默认：USD）]

  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus; // Status (default: active)[状态（默认：active）]

  @IsUUID()
  @IsOptional()
  updatedBy?: string; // User ID who updated the price[更新价格的用户ID]

  @IsOptional()
  metadata?: Record<string, unknown>; // Additional metadata[额外元数据]
}
