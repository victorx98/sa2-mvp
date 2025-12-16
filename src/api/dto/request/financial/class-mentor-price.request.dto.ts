import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { ClassMentorPriceStatus } from "@shared/types/financial-enums";

export class CreateClassMentorPriceRequestDto {
  @ApiProperty({
    description: "Class ID (UUID). [班级ID(UUID)]",
    type: String,
    required: true,
    format: "uuid",
  })
  @IsUUID()
  @IsNotEmpty()
  classId!: string;

  @ApiProperty({
    description: "Mentor user ID (UUID). [导师用户ID(UUID)]",
    type: String,
    required: true,
    format: "uuid",
  })
  @IsUUID()
  @IsNotEmpty()
  mentorUserId!: string;

  @ApiProperty({
    description: "Price per session (integer). [每次会话价格(整数)]",
    type: Number,
    required: true,
    example: 200,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  pricePerSession!: number;
}

export class UpdateClassMentorPriceRequestDto {
  @ApiPropertyOptional({
    description: "New price per session (integer). [新的每次会话价格(整数)]",
    type: Number,
    required: false,
    minimum: 1,
    example: 220,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  pricePerSession?: number;
}

export class UpdateClassMentorPriceStatusRequestDto {
  @ApiProperty({
    description: "New status. [新状态]",
    enum: ClassMentorPriceStatus,
    required: true,
    example: ClassMentorPriceStatus.ACTIVE,
  })
  @IsEnum(ClassMentorPriceStatus)
  @IsNotEmpty()
  status!: ClassMentorPriceStatus;
}

export class SearchClassMentorPricesQueryDto {
  @ApiPropertyOptional({
    description: "Filter by class ID (UUID). [按班级ID(UUID)筛选]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  classId?: string;

  @ApiPropertyOptional({
    description: "Filter by mentor user ID (UUID). [按导师用户ID(UUID)筛选]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  mentorUserId?: string;

  @ApiPropertyOptional({
    description:
      "Filter by status. Default: ACTIVE when omitted. [按状态筛选，不传默认ACTIVE]",
    enum: ClassMentorPriceStatus,
    required: false,
    default: ClassMentorPriceStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ClassMentorPriceStatus)
  status?: ClassMentorPriceStatus;

  @ApiPropertyOptional({
    description: "Page number. Default: 1. [页码，默认1]",
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
  page: number = 1;

  @ApiPropertyOptional({
    description: "Page size. Default: 20. [每页条数，默认20]",
    type: Number,
    required: false,
    default: 20,
    minimum: 1,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize: number = 20;

  @ApiPropertyOptional({
    description:
      "Sort field. Allowed: createdAt, updatedAt, pricePerSession. Default: createdAt. [排序字段：createdAt/updatedAt/pricePerSession，默认createdAt]",
    type: String,
    required: false,
    default: "createdAt",
    enum: ["createdAt", "updatedAt", "pricePerSession"],
  })
  @IsOptional()
  @IsString()
  sortField?: string = "createdAt";

  @ApiPropertyOptional({
    description: "Sort order. Default: desc. [排序方向，默认desc]",
    type: String,
    required: false,
    default: "desc",
    enum: ["asc", "desc"],
  })
  @IsOptional()
  @IsString()
  sortOrder?: string = "desc";
}

