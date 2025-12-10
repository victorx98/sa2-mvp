/**
 * Update Mentor Price Status DTO[更新导师价格状态DTO]
 *
 * This DTO defines the data structure for updating mentor price status[此DTO定义了更新导师价格状态的数据结构]
 */

import { IsString, IsNotEmpty, IsEnum } from "class-validator";

export class UpdateMentorPriceStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsEnum(["active", "inactive"])
  status: "active" | "inactive"; // Status to update[要更新的状态]
}

