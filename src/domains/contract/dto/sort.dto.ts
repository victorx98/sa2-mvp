import { IsString, IsEnum } from "class-validator";

/**
 * DTO for sorting (排序DTO)
 * Generic sort parameters (通用排序参数)
 */
export class SortDto {
  @IsString()
  field: string; // Field to sort by (排序字段)

  @IsEnum(["asc", "desc"])
  order: "asc" | "desc"; // Sort order (排序顺序)
}
