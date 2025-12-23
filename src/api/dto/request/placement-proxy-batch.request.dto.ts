import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
  ValidateNested,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

/**
 * Proxy job DTO [代投岗位DTO]
 * Contains job information for proxy application flow [包含代投流程的岗位信息]
 */
export class ProxyJobDto {
  @ApiProperty({
    description:
      "Algolia object ID. Required. [Algolia岗位ID，必填]",
    type: String,
    required: true,
    example: "algolia_job_123",
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  objectId!: string;

  @ApiProperty({
    description:
      "External job ID. Required. [外部岗位ID，必填]",
    type: String,
    required: true,
    example: "EXT-123",
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  externalJobId!: string;

  @ApiProperty({
    description:
      "Job link URL. Required. [岗位链接，必填]",
    type: String,
    required: true,
    example: "https://example.com/job/123",
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  jobLink!: string;

  @ApiProperty({
    description:
      "Job type. Required. [职位类型，必填]",
    type: String,
    required: true,
    example: "full-time",
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  jobType!: string;

  @ApiProperty({
    description:
      "Job title. Required. [职位标题，必填]",
    type: String,
    required: true,
    example: "Software Engineer",
    maxLength: 300,
  })
  @IsString()
  @MaxLength(300)
  jobTitle!: string;

  @ApiProperty({
    description:
      "Company name. Required. [公司名称，必填]",
    type: String,
    required: true,
    example: "Example Company",
    maxLength: 300,
  })
  @IsString()
  @MaxLength(300)
  companyName!: string;

  @ApiProperty({
    description:
      "Job location. Required. [工作地点，必填]",
    type: String,
    required: true,
    example: "San Francisco, CA",
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  location!: string;

  @ApiProperty({
    description:
      "Job categories array. Required. [职位类别数组，必填]",
    type: [String],
    isArray: true,
    required: true,
    example: ["ADMIN", "TECH"],
  })
  @IsArray()
  @IsString({ each: true })
  jobCategories!: string[];

  @ApiProperty({
    description:
      "Normalized job title. Required. [标准化职位标题，必填]",
    type: String,
    required: true,
    example: "Software Engineer",
    maxLength: 300,
  })
  @IsString()
  @MaxLength(300)
  normalJobTitle!: string;

  @ApiProperty({
    description:
      "Job level. Required. [职位级别，必填]",
    type: String,
    required: true,
    example: "entry_level",
    maxLength: 20,
  })
  @IsString()
  @MaxLength(20)
  level!: string;
}

export class PlacementProxyBatchRequestDto {
  @ApiProperty({
    description:
      "Student IDs (UUID strings). Unique and non-empty. [学生ID(UUID字符串)列表，需去重且非空]",
    type: [String],
    isArray: true,
    required: true,
    example: ["123e4567-e89b-12d3-a456-426614174000"],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  studentIds!: string[];

  @ApiProperty({
    description:
      "Jobs array. Each job contains objectId and redundant fields. Required. [岗位数组，每个岗位包含objectId和冗余字段，必填]",
    type: [ProxyJobDto],
    isArray: true,
    required: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProxyJobDto)
  jobs!: ProxyJobDto[];
}

