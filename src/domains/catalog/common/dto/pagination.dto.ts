import { IsInt, IsOptional, Min, Max } from "class-validator";
import { Type } from "class-transformer";

// Pagination parameters (optional, if not provided returns all)
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1; // Page number, starting from 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20; // Number per page, default 20, max 100
}
