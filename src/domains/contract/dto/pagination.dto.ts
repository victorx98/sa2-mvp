import { IsInt, Min, Max } from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for pagination (分页DTO)
 * Generic pagination parameters (通用分页参数)
 */
export class PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number; // Current page number (当前页码)

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number; // Items per page (每页条目数)
}
