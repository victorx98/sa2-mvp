/**
 * Update Mentor Price DTO[更新导师价格DTO]
 *
 * This DTO defines the data structure for updating mentor price records[此DTO定义了更新导师价格记录的数据结构]
 */

import { IsString, IsNumber, IsOptional, IsEnum } from "class-validator";

export class UpdateMentorPriceDto {
  @IsNumber()
  @IsOptional()
  price?: number; // Price per unit[单价]

  @IsString()
  @IsOptional()
  currency?: string; // Currency code (default: USD)[货币代码（默认：USD）]

  @IsString()
  @IsOptional()
  status?: string; // Status (active/inactive)[状态（active/inactive）]

  @IsString()
  @IsOptional()
  packageCode?: string; // Package code (optional)[课程包编码（可选）]
}
