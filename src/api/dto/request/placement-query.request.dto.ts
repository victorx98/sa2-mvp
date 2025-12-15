/**
 * Placement Job Query Request DTO [岗位查询请求DTO]
 * Used for validating and transforming job query requests [用于验证和转换岗位查询请求]
 */
import { IsOptional, IsString, IsArray, IsInt, Min, IsEnum, IsDateString, IsNotEmpty } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApplicationType, JobLevel } from '@domains/placement/types';

/**
 * Custom transformer to convert string to array [自定义转换器，将字符串转换为数组]
 * @param value - The value to transform [要转换的值]
 * @returns Array of strings [字符串数组]
 */
const stringToArray = (value: any): string[] => {
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
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  // Sorting parameters [排序参数]
  @IsOptional()
  @IsString()
  sortField?: string = 'postDate';

  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection = SortDirection.DESC;

  // Filter parameters [筛选参数]
  @IsOptional()
  @IsString()
  location?: string; // Single location value [单个地点值]

  @IsOptional()
  @IsString()
  jobType?: string; // Single job type value [单个职位类型值]

  @IsOptional()
  @IsEnum(JobLevel)
  level?: JobLevel; // Job level requirement (entry_level, mid_level, senior_level) [岗位级别要求]

  @IsOptional()
  @Transform(({ value }) => stringToArray(value))
  @IsArray()
  @IsString({ each: true })
  jobTitles?: string[];

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  status?: string = 'active';

  @IsOptional()
  @IsString()
  h1b?: string;

  @IsOptional()
  @IsString()
  usCitizenship?: string;

  // Job application type filter [岗位投递类型筛选] - Required single value [必填单值]
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
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}