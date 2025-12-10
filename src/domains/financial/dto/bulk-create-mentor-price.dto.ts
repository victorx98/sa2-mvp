/**
 * Bulk Create Mentor Price DTO[批量创建导师价格DTO]
 *
 * This DTO defines the data structure for bulk creating mentor price records[此DTO定义了批量创建导师价格记录的数据结构]
 */

import { IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CreateMentorPriceDto } from "./create-mentor-price.dto";

export class BulkCreateMentorPriceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMentorPriceDto)
  prices: CreateMentorPriceDto[]; // Array of mentor prices to create[要创建的导师价格数组]
}
