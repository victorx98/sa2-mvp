import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from "class-validator";

export enum SortDirection {
  ASC = "asc",
  DESC = "desc",
}

/**
 * List Mentor Appeals Query DTO
 * [导师申诉列表查询DTO]
 */
export class ListMentorAppealsQueryDto {
  @ApiPropertyOptional({
    description: "当前页码，默认值：1. [Page number, default: 1]",
    type: Number,
    minimum: 1,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "每页条数，默认值：20，最大值：100. [Page size, default: 20, max: 100]",
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({
    description:
      "排序字段，默认：createdAt. [Sort field, default: createdAt]. 可选值: createdAt, appealAmount, status",
    type: String,
    default: "createdAt",
    example: "createdAt",
  })
  @IsOptional()
  @IsString()
  @IsIn(["createdAt", "appealAmount", "status"])
  sortBy?: string = "createdAt";

  @ApiPropertyOptional({
    description: "排序方向，默认：desc. [Sort direction, default: desc]",
    enum: SortDirection,
    default: SortDirection.DESC,
    example: SortDirection.DESC,
  })
  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection = SortDirection.DESC;

  @ApiPropertyOptional({
    description: "筛选：申诉状态. [Filter: Appeal status]",
    type: String,
    enum: ["PENDING", "APPROVED", "REJECTED"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["PENDING", "APPROVED", "REJECTED"])
  status?: string;

  @ApiPropertyOptional({
    description: "筛选：导师ID. [Filter: Mentor ID]",
    type: String,
    format: "uuid",
  })
  @IsOptional()
  @IsString()
  mentorId?: string;

  @ApiPropertyOptional({
    description: "筛选：顾问ID. [Filter: Counselor ID]",
    type: String,
    format: "uuid",
  })
  @IsOptional()
  @IsString()
  counselorId?: string;

  @ApiPropertyOptional({
    description: "筛选：学生ID. [Filter: Student ID]",
    type: String,
    format: "uuid",
  })
  @IsOptional()
  @IsString()
  studentId?: string;

  @ApiPropertyOptional({
    description: "筛选：申诉类型. [Filter: Appeal type]",
    type: String,
    enum: ["billing_error", "missing_service", "price_dispute", "other"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["billing_error", "missing_service", "price_dispute", "other"])
  appealType?: string;

  @ApiPropertyOptional({
    description: "筛选：支付月份 (YYYY-MM格式). [Filter: Payment month (YYYY-MM format)]",
    type: String,
    example: "2025-11",
  })
  @IsOptional()
  @IsString()
  paymentMonth?: string;
}

