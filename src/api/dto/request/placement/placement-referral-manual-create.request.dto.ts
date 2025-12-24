import { IsString, IsUUID, IsDate, IsOptional, IsArray } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

/**
 * Manual create referral request DTO [手工创建内推请求DTO]
 * - Used for counselor to manually create job applications with mentor assigned status [用于顾问手工创建内推投递记录，状态默认设置为mentor_assigned]
 */
export class PlacementReferralManualCreateRequestDto {
  @ApiProperty({
    description: "Student user ID (UUID string). [学生用户ID(UUID字符串)]",
    type: String,
    required: true,
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  studentId!: string;

  @ApiProperty({
    description: "Mentor user ID (UUID string). [导师用户ID(UUID字符串)]",
    type: String,
    required: true,
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  mentorId!: string;

  @ApiProperty({
    description: "Created by user ID (UUID string). [创建人用户ID(UUID字符串)]",
    type: String,
    required: false,
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiProperty({
    description: "Job type. [职位类型]",
    type: String,
    required: true,
    example: "full-time",
  })
  @IsString()
  jobType!: string;

  @ApiProperty({
    description: "Resume submitted date. [简历提交日期]",
    type: Date,
    required: true,
    example: "2023-01-01T00:00:00Z",
  })
  @Type(() => Date)
  @IsDate()
  resumeSubmittedDate!: Date;

  @ApiProperty({
    description: "Job title. [职位标题]",
    type: String,
    required: true,
    example: "Software Engineer",
  })
  @IsString()
  jobTitle!: string;

  @ApiProperty({
    description: "Job link URL. [职位链接]",
    type: String,
    required: true,
    example: "https://example.com/job/123",
  })
  @IsString()
  jobLink!: string;

  @ApiProperty({
    description: "Job ID. [职位ID]",
    type: String,
    required: false,
    example: "EXT-123",
  })
  @IsOptional()
  @IsString()
  jobId?: string;

  @ApiProperty({
    description: "Company name. [公司名称]",
    type: String,
    required: true,
    example: "Example Company",
  })
  @IsString()
  companyName!: string;

  @ApiProperty({
    description: "Job location. [工作地点]",
    type: String,
    required: false,
    example: "San Francisco, CA",
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({
    description: "Job categories. [职位类别]",
    type: [String],
    required: false,
    example: ["ADMIN"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  jobCategories?: string[];

  @ApiProperty({
    description: "Normalized job title. [标准化职位标题]",
    type: String,
    required: false,
    example: "Software Engineer",
  })
  @IsOptional()
  @IsString()
  normalJobTitle?: string;

  @ApiProperty({
    description: "Job level. [职位级别]",
    type: String,
    required: false,
    example: "Entry Level",
  })
  @IsOptional()
  @IsString()
  level?: string;
}