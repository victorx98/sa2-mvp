/**
 * Bulk Update Mentor Price DTO[批量更新导师价格DTO]
 *
 * This DTO defines the data structure for bulk updating mentor price records[此DTO定义了批量更新导师价格记录的数据结构]
 */

import { IsArray, ValidateNested, IsString, IsNotEmpty } from "class-validator";
import { Type } from "class-transformer";
import { UpdateMentorPriceDto } from "./update-mentor-price.dto";

export class BulkUpdateMentorPriceItemDto {
  @IsString()
  @IsNotEmpty()
  id: string; // Mentor price ID[导师价格ID]

  @ValidateNested()
  @Type(() => UpdateMentorPriceDto)
  dto: UpdateMentorPriceDto; // Update DTO[更新DTO]
}

export class BulkUpdateMentorPriceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateMentorPriceItemDto)
  updates: BulkUpdateMentorPriceItemDto[]; // Array of mentor price updates[要更新的导师价格数组]
}

