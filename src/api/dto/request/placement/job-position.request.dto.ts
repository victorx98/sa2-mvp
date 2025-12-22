import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";

class ExperienceRequirementRequestDto {
  @ApiPropertyOptional({
    description: "Minimum years of experience. [最低经验年数]",
    type: Number,
    required: false,
    example: 1,
  })
  @IsOptional()
  min_years?: number;

  @ApiPropertyOptional({
    description: "Maximum years of experience. [最高经验年数]",
    type: Number,
    required: false,
    example: 5,
  })
  @IsOptional()
  max_years?: number;

  @ApiPropertyOptional({
    description: "Unlimited experience requirement. [经验不限标记]",
    type: Boolean,
    required: false,
    example: false,
  })
  @IsOptional()
  unlimited?: boolean;
}

class SalaryRangeRequestDto {
  @ApiPropertyOptional({ description: "Min base salary. [最低基本工资]", type: Number })
  @IsOptional()
  min?: number;

  @ApiPropertyOptional({ description: "Max base salary. [最高基本工资]", type: Number })
  @IsOptional()
  max?: number;
}

class SalaryDetailsRequestDto {
  @ApiPropertyOptional({
    description: "Base salary range. [基本工资范围]",
    type: () => SalaryRangeRequestDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SalaryRangeRequestDto)
  base_salary?: SalaryRangeRequestDto;

  @ApiPropertyOptional({
    description:
      "Bonus details (free-form JSON). [奖金详情(自由结构JSON)]",
    type: Object,
    required: false,
  })
  @IsOptional()
  bonus?: Record<string, unknown>;
}

export class CreateJobPositionRequestDto {
  @ApiPropertyOptional({
    description:
      "Idempotency key from source system (optional). [幂等键(可选)]",
    type: String,
    required: false,
    example: "obj_123",
  })
  @IsOptional()
  @IsString()
  objectId?: string;

  @ApiProperty({
    description: "Job title. [岗位标题]",
    type: String,
    required: true,
    example: "Software Engineer",
  })
  @IsString()
  @IsNotEmpty()
  jobTitle!: string;

  @ApiProperty({
    description: "Company name. [公司名称]",
    type: String,
    required: true,
    example: "Example Inc.",
  })
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @ApiPropertyOptional({
    description:
      "Normalized job titles for search. [用于搜索的标准化职位标题列表]",
    type: [String],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  normJobTitles?: string[];

  @ApiPropertyOptional({
    description: "Job types. [职位类型分类]",
    type: [String],
    isArray: true,
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  jobTypes?: string[];

  @ApiPropertyOptional({
    description:
      "Post date (ISO 8601). [发布日期(ISO 8601)]",
    type: String,
    format: "date-time",
    required: false,
    example: "2025-12-01T00:00:00.000Z",
  })
  @IsOptional()
  postDate?: Date;

  @ApiPropertyOptional({
    description:
      "Job status. Default: active. [岗位状态，默认active]",
    type: String,
    required: false,
    enum: ["active", "inactive", "expired"],
    default: "active",
    example: "active",
  })
  @IsOptional()
  @IsIn(["active", "inactive", "expired"])
  status?: "active" | "inactive" | "expired";

  @ApiPropertyOptional({
    description: "Country code (e.g., US). [国家代码]",
    type: String,
    required: false,
    example: "US",
  })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({
    description: "Job locations. [工作地点列表]",
    type: [String],
    isArray: true,
    required: false,
    example: ["San Jose, CA"],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @ApiPropertyOptional({
    description: "Experience requirement object. [经验要求对象]",
    type: () => ExperienceRequirementRequestDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExperienceRequirementRequestDto)
  experienceRequirement?: ExperienceRequirementRequestDto;

  @ApiPropertyOptional({
    description: "Salary details object. [薪资详情对象]",
    type: () => SalaryDetailsRequestDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SalaryDetailsRequestDto)
  salaryDetails?: SalaryDetailsRequestDto;

  @ApiPropertyOptional({
    description: "Job description. [岗位描述]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  jobDescription?: string;

  @ApiPropertyOptional({
    description: "H1B visa support status. [H1B签证支持状态]",
    type: String,
    required: false,
    example: "yes",
  })
  @IsOptional()
  @IsString()
  h1b?: string;

  @ApiPropertyOptional({
    description: "US citizenship requirement. [美国公民身份要求]",
    type: String,
    required: false,
    example: "no",
  })
  @IsOptional()
  @IsString()
  usCitizenship?: string;

  @ApiPropertyOptional({
    description:
      "Supported application types for this job. [支持的投递类型]",
    type: [String],
    isArray: true,
    required: false,
    example: ["direct", "referral"],
  })
  @IsOptional()
  @IsArray()
  @IsIn(["direct", "proxy", "referral", "bd"], { each: true })
  jobApplicationType?: Array<"direct" | "proxy" | "referral" | "bd">;

  @ApiProperty({
    description: "Source of the job data. [岗位数据来源]",
    type: String,
    required: true,
    enum: ["web", "bd"],
    example: "bd",
  })
  @IsNotEmpty()
  @IsIn(["web", "bd"])
  source!: "web" | "bd";
}

/**
 * Request DTO for rolling back job application status [用于回滚投递状态的请求DTO]
 *
 * This DTO contains all fields required for status rollback operation.
 * 此DTO包含状态回滚操作所需的所有字段。
 */
export class RollbackJobApplicationStatusRequestDto {
  @ApiProperty({
    description: "Application ID (UUID) [投递ID(UUID)]",
    type: String,
    format: "uuid",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID("4", { message: "applicationId must be a valid UUID [applicationId必须是有效的UUID]" })
  applicationId!: string; // Unique identifier of the job application to rollback [要回滚的投递的唯一标识符]

  @ApiPropertyOptional({
    description:
      "Changed by user ID (UUID). If omitted, server uses current user. [变更人用户ID(UUID)，不传则使用当前用户]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  changedBy?: string; // User ID who performed the rollback [执行回滚的用户ID]

  @ApiPropertyOptional({
    description:
      "Mentor ID (UUID). Used to keep assignedMentorId consistent if needed. [导师ID(UUID)，用于必要时保持assignedMentorId一致]",
    type: String,
    required: false,
    format: "uuid",
  })
  @IsOptional()
  @IsUUID()
  mentorId?: string; // ID of the mentor assigned to the application [分配给该投递的导师ID]

  @ApiPropertyOptional({
    description: "Reason for rollback [回滚原因]",
    type: String,
    example: "Status update was made in error",
  })
  @IsOptional()
  @IsString()
  rollbackReason?: string; // Explanation for why the rollback was performed [执行回滚的解释说明]
}

