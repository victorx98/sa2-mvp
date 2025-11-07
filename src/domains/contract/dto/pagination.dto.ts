import { IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

/**
 * Pagination DTO
 * Generic pagination parameters
 */
export class PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number;
}
