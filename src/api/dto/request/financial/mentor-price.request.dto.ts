import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
} from "class-validator";

export class CreateMentorPriceRequestDto {
  @ApiProperty({
    description: "Mentor user ID (UUID). [导师用户ID(UUID)]",
    type: String,
    format: "uuid",
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  mentorUserId!: string;

  @ApiProperty({
    description:
      "Session type code (e.g., regular_mentoring). [会话类型代码]",
    type: String,
    required: true,
    example: "regular_mentoring",
  })
  @IsString()
  @IsNotEmpty()
  sessionTypeCode!: string;

  @ApiProperty({
    description: "Price per session. [每次会话价格]",
    type: Number,
    required: true,
    example: 200,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({
    description:
      "Currency (ISO 4217). Default: USD. [币种(ISO 4217)，默认USD]",
    type: String,
    required: false,
    default: "USD",
    example: "USD",
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    description:
      "Status. Default: active. [状态，默认active]",
    type: String,
    required: false,
    default: "active",
    enum: ["active", "inactive"],
    example: "active",
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: "Package code (optional). [课程包编码(可选)]",
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  packageCode?: string;
}

export class UpdateMentorPriceRequestDto {
  @ApiPropertyOptional({
    description: "New price per session. [新的每次会话价格]",
    type: Number,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    description:
      "New currency (ISO 4217). [新的币种(ISO 4217)]",
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    description: "New status. [新的状态]",
    type: String,
    required: false,
    enum: ["active", "inactive"],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({
    description: "New package code. [新的课程包编码]",
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  packageCode?: string;
}

export class UpdateMentorPriceStatusRequestDto {
  @ApiProperty({
    description: "Target status. [目标状态]",
    type: String,
    required: true,
    enum: ["active", "inactive"],
    example: "active",
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(["active", "inactive"])
  status!: "active" | "inactive";
}

export class BulkCreateMentorPriceRequestDto {
  @ApiProperty({
    description: "Prices to create. [要创建的价格配置列表]",
    type: () => CreateMentorPriceRequestDto,
    isArray: true,
    required: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMentorPriceRequestDto)
  prices!: CreateMentorPriceRequestDto[];
}

class BulkUpdateMentorPriceItemRequestDto {
  @ApiProperty({
    description: "Mentor price ID (UUID). [导师价格ID(UUID)]",
    type: String,
    format: "uuid",
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @ApiProperty({
    description: "Update payload. [更新内容]",
    type: () => UpdateMentorPriceRequestDto,
    required: true,
  })
  @ValidateNested()
  @Type(() => UpdateMentorPriceRequestDto)
  dto!: UpdateMentorPriceRequestDto;
}

export class BulkUpdateMentorPriceRequestDto {
  @ApiProperty({
    description: "Batch updates. [批量更新列表]",
    type: () => BulkUpdateMentorPriceItemRequestDto,
    isArray: true,
    required: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateMentorPriceItemRequestDto)
  updates!: BulkUpdateMentorPriceItemRequestDto[];
}


// Type aliases for backward compatibility
export type CreateMentorPriceDto = CreateMentorPriceRequestDto;
export type UpdateMentorPriceDto = UpdateMentorPriceRequestDto;
export type UpdateMentorPriceStatusDto = UpdateMentorPriceStatusRequestDto;

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListMentorPricesQueryDto {
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
      "排序字段，默认：createdAt. [Sort field, default: createdAt]. 可选值: createdAt, updatedAt, price, mentorUserId, status",
    type: String,
    default: "createdAt",
    example: "createdAt",
  })
  @IsOptional()
  @IsString()
  @IsIn(["createdAt", "updatedAt", "price", "mentorUserId", "status"])
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
    description: "筛选：导师用户ID. [Filter: Mentor user ID]",
    type: String,
    format: "uuid",
  })
  @IsOptional()
  @IsString()
  mentorUserId?: string;

  @ApiPropertyOptional({
    description: "筛选：状态. [Filter: Status]",
    type: String,
    enum: ["active", "inactive"],
  })
  @IsOptional()
  @IsString()
  @IsIn(["active", "inactive"])
  status?: string;
}
