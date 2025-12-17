/**
 * Placement Job Query Request DTO [岗位查询请求DTO]
 * Used for validating and transforming job query requests [用于验证和转换岗位查询请求]
 */
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsArray, IsInt, Min, Max, IsEnum, IsDateString, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApplicationType, JobLevel } from '@domains/placement/types';

/**
 * Custom transformer to convert string to array [自定义转换器，将字符串转换为数组]
 * @param value - The value to transform [要转换的值]
 * @returns Array of strings [字符串数组]
 */
const stringToArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    return [value];
  }
  return [];
};

/**
 * Sort direction enum [排序方向枚举]
 */
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Job query request DTO [岗位查询请求DTO]
 */
export class JobQueryDto {
  // Pagination parameters [分页参数]
  @ApiPropertyOptional({
    description: "Page number (1-based). Default: 1. [页码(从1开始)，默认1]",
    type: Number,
    required: false,
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Page size. Default: 20. [每页条数，默认20]",
    type: Number,
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  // Sorting parameters [排序参数]
  @ApiPropertyOptional({
    description:
      "Sort field. Default: postDate. [排序字段，默认postDate]",
    type: String,
    required: false,
    default: "postDate",
    example: "postDate",
  })
  @IsOptional()
  @IsString()
  sortField?: string = 'postDate';

  @ApiPropertyOptional({
    description:
      "Sort direction. Default: desc. [排序方向，默认desc]",
    enum: SortDirection,
    required: false,
    default: SortDirection.DESC,
    example: SortDirection.DESC,
  })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection = SortDirection.DESC;

  // Filter parameters [筛选参数]
  @ApiPropertyOptional({
    description: "Location filter (single value). [地点筛选(单值)]",
    type: String,
    required: false,
    example: "San Jose, CA",
  })
  @IsOptional()
  @IsString()
  location?: string; // Single location value [单个地点值]

  @ApiPropertyOptional({
    description: "Job type filter (single value). [职位类型筛选(单值)]",
    type: String,
    required: false,
    example: "full_time",
  })
  @IsOptional()
  @IsString()
  jobType?: string; // Single job type value [单个职位类型值]

  @ApiPropertyOptional({
    description:
      "Job level filter. [岗位级别筛选]",
    enum: JobLevel,
    required: false,
    example: JobLevel.ENTRY_LEVEL,
  })
  @IsOptional()
  @IsEnum(JobLevel)
  level?: JobLevel; // Job level requirement (entry_level, mid_level, senior_level) [岗位级别要求]

  @ApiPropertyOptional({
    description:
      "Job titles filter (multi). [职位标题筛选(多值)]",
    type: [String],
    isArray: true,
    required: false,
    example: ["Software Engineer", "Backend Engineer"],
  })
  @IsOptional()
  @Transform(({ value }) => stringToArray(value))
  @IsArray()
  @IsString({ each: true })
  jobTitles?: string[];

  @ApiPropertyOptional({
    description:
      "Keyword search on title/company. [关键词搜索(标题/公司)]",
    type: String,
    required: false,
    example: "OpenAI",
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description: "Job status filter. Default: active. [岗位状态筛选，默认active]",
    type: String,
    required: false,
    default: "active",
    example: "active",
  })
  @IsOptional()
  @IsString()
  status?: string = 'active';

  @ApiPropertyOptional({
    description: "H1B support filter. [H1B筛选]",
    type: String,
    required: false,
    example: "yes",
  })
  @IsOptional()
  @IsString()
  h1b?: string;

  @ApiPropertyOptional({
    description: "US citizenship requirement filter. [美国公民身份筛选]",
    type: String,
    required: false,
    example: "no",
  })
  @IsOptional()
  @IsString()
  usCitizenship?: string;

  // Job application type filter [岗位投递类型筛选] - Required single value [必填单值]
  @ApiProperty({
    description:
      "Job application type filter (single value). Required. [投递类型筛选(单值)，必填]",
    enum: ApplicationType,
    required: true,
    example: ApplicationType.DIRECT,
  })
  @IsNotEmpty()
  @IsEnum(ApplicationType)
  @Transform(({ value }) => {
    // Reject array input [拒绝数组输入]
    if (Array.isArray(value)) {
      throw new Error('jobApplicationType must be a single value, not an array');
    }
    return value;
  })
  jobApplicationType!: ApplicationType;

  // Date range filters [日期范围筛选]
  @ApiPropertyOptional({
    description: "Start date (ISO 8601). [开始日期(ISO 8601)]",
    type: String,
    required: false,
    example: "2025-11-01",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date (ISO 8601). [结束日期(ISO 8601)]",
    type: String,
    required: false,
    example: "2025-11-30",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}