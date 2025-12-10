import { IsEnum, IsOptional, IsString } from "class-validator";

// Sort parameters (optional)
export class SortDto {
  @IsOptional()
  @IsString()
  orderField?: string = "createdAt"; // Field name to sort by

  @IsOptional()
  @IsEnum(["asc", "desc"])
  orderDirection?: "asc" | "desc" = "desc"; // Sort direction
}
