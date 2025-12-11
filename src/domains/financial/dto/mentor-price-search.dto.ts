/**
 * Mentor Price Search DTO[导师价格搜索DTO]
 *
 * This DTO defines the search/filter criteria for mentor price queries[此DTO定义了导师价格查询的搜索/过滤条件]
 */

import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from "class-validator";

export class MentorPriceSearchDto {
  @IsString()
  @IsOptional()
  mentorUserId?: string; // Filter by mentor user ID[按导师用户ID过滤]

  @IsString()
  @IsOptional()
  sessionTypeCode?: string; // Filter by session type code[按会话类型代码过滤]

  @IsString()
  @IsOptional()
  status?: string; // Filter by status (active/inactive)[按状态过滤（active/inactive）]

  @IsString()
  @IsOptional()
  packageCode?: string; // Filter by package code[按课程包编码过滤]

  @IsNumber()
  @IsOptional()
  @Min(1)
  page?: number; // Page number (default: 1)[页码（默认：1）]

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  pageSize?: number; // Page size (default: 20, max: 100)[每页大小（默认：20，最大：100）]

  @IsString()
  @IsOptional()
  sortField?: string; // Sort field (e.g., createdAt, price)[排序字段（如：createdAt, price）]

  @IsString()
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sortOrder?: "asc" | "desc"; // Sort order[排序方向]
}
