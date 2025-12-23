/**
 * Job Application Query Request DTO [投递申请查询请求DTO]
 * Used for validating and transforming job application query requests [用于验证和转换投递申请查询请求]
 */
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsInt, Min, Max, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApplicationType } from '@domains/placement/types';
import { APPLICATION_STATUSES } from '@domains/placement/types/application-status.types';
import { SortDirection } from './placement-query.request.dto';

/**
 * Job application query request DTO [投递申请查询请求DTO]
 */
export class JobApplicationQueryDto {
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
      "Sort field. Default: submittedAt. [排序字段，默认submittedAt]",
    type: String,
    required: false,
    default: "submittedAt",
    example: "submittedAt",
  })
  @IsOptional()
  @IsString()
  sortField?: string = 'submittedAt';

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
    description: "Application status filter. [申请状态筛选]",
    enum: APPLICATION_STATUSES,
    required: false,
    example: "submitted",
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: "Application type filter. [申请类型筛选]",
    enum: ApplicationType,
    required: false,
    example: ApplicationType.REFERRAL,
  })
  @IsOptional()
  @IsEnum(ApplicationType)
  applicationType?: ApplicationType;

  @ApiPropertyOptional({
    description: "Student ID filter. [学生ID筛选]",
    type: String,
    required: false,
    example: "4d521e1f-7477-4744-b01b-845eab4155a0",
  })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({
    description: "Assigned mentor ID filter. [分配的导师ID筛选]",
    type: String,
    required: false,
    example: "65d6a77c-5a21-4c67-b6bb-6ef905bf4e0f",
  })
  @IsOptional()
  @IsString()
  assignedMentorId?: string;

  @ApiPropertyOptional({
    description: "Recommended by (counselor) ID filter. [推荐人(顾问)ID筛选]",
    type: String,
    required: false,
    example: "65d6a77c-5a21-4c67-b6bb-6ef905bf4e0f",
  })
  @IsOptional()
  @IsString()
  recommendedBy?: string;

  // Date range filters [日期范围筛选]
  @ApiPropertyOptional({
    description: "Start date (ISO 8601). [开始日期(ISO 8601)]",
    type: String,
    required: false,
    example: "2025-01-01",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date (ISO 8601). [结束日期(ISO 8601)]",
    type: String,
    required: false,
    example: "2025-12-31",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

