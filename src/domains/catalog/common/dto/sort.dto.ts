import { IsEnum, IsOptional, IsString } from "class-validator";

// Sort parameters (optional)
export class SortDto {
  @IsOptional()
  @IsString()
  field?: string = "createdAt"; // Field name to sort by

  @IsOptional()
  @IsEnum(["asc", "desc"])
  order?: "asc" | "desc" = "desc"; // Sort direction
}
