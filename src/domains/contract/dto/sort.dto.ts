import { IsString, IsEnum } from "class-validator";

/**
 * Sort DTO
 * Generic sort parameters
 */
export class SortDto {
  @IsString()
  field: string;

  @IsEnum(["asc", "desc"])
  order: "asc" | "desc";
}
