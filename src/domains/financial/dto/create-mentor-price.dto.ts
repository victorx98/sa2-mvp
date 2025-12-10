/**
 * Create Mentor Price DTO[创建导师价格DTO]
 *
 * This DTO defines the data structure for creating mentor price records[此DTO定义了创建导师价格记录的数据结构]
 */

import { IsString, IsNotEmpty, IsNumber, IsOptional } from "class-validator";

export class CreateMentorPriceDto {
  @IsString()
  @IsNotEmpty()
  mentorId: string; // Mentor ID[导师ID] (varchar(32) in schema)

  @IsString()
  @IsNotEmpty()
  sessionTypeCode: string; // Session type code (references session_types.code)[会话类型代码（引用session_types.code）]

  @IsNumber()
  @IsNotEmpty()
  price: number; // Price per unit[单价]

  @IsString()
  @IsOptional()
  currency?: string; // Currency code (default: USD)[货币代码（默认：USD）]

  @IsString()
  @IsOptional()
  status?: string; // Status (default: active)[状态（默认：active）]

  @IsString()
  @IsOptional()
  packageCode?: string; // Package code (optional)[课程包编码（可选）]

  @IsString()
  @IsOptional()
  updatedBy?: string; // User ID who updated the price[更新价格的用户ID]
}
