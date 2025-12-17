import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { APPLICATION_STATUSES } from "@domains/placement/types/application-status.types";
import type { ApplicationStatus, ApplicationType } from "@domains/placement/types";

class ExperienceRequirementResponseDto {
  @ApiPropertyOptional({ description: "Minimum years. [最低经验年数]", type: Number })
  min_years?: number;

  @ApiPropertyOptional({ description: "Maximum years. [最高经验年数]", type: Number })
  max_years?: number;

  @ApiPropertyOptional({ description: "Unlimited flag. [不限标记]", type: Boolean })
  unlimited?: boolean;
}

class SalaryRangeResponseDto {
  @ApiPropertyOptional({ description: "Min base salary. [最低基本工资]", type: Number })
  min?: number;

  @ApiPropertyOptional({ description: "Max base salary. [最高基本工资]", type: Number })
  max?: number;
}

class SalaryDetailsResponseDto {
  @ApiPropertyOptional({
    description: "Base salary range. [基本工资范围]",
    type: () => SalaryRangeResponseDto,
  })
  base_salary?: SalaryRangeResponseDto;

  @ApiPropertyOptional({
    description: "Bonus details. [奖金详情]",
    type: Object,
  })
  bonus?: Record<string, unknown>;
}

export class JobPositionResponseDto {
  @ApiProperty({ description: "Job ID (UUID). [岗位ID(UUID)]", type: String, format: "uuid" })
  id!: string;

  @ApiPropertyOptional({ description: "External job id. [外部岗位ID]", type: String })
  jobId?: string | null;

  @ApiPropertyOptional({ description: "Job link URL. [岗位链接]", type: String })
  jobLink?: string | null;

  @ApiPropertyOptional({ description: "Idempotency object id. [幂等对象ID]", type: String })
  objectId?: string | null;

  @ApiPropertyOptional({
    description: "Normalized job titles. [标准化职位标题]",
    type: [String],
    isArray: true,
  })
  normalizedJobTitles?: string[] | null;

  @ApiPropertyOptional({
    description: "Job types. [职位类型]",
    type: [String],
    isArray: true,
  })
  jobTypes?: string[] | null;

  @ApiPropertyOptional({
    description: "Post date (ISO 8601). [发布日期(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  postDate?: string | null;

  @ApiPropertyOptional({
    description: "Application deadline (ISO 8601). [投递截止时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  application_deadline?: string | null;

  @ApiProperty({
    description: "Status (active/inactive/expired). [状态：active/inactive/expired]",
    type: String,
    example: "active",
  })
  status!: string;

  @ApiProperty({ description: "Job title. [岗位标题]", type: String })
  title!: string;

  @ApiPropertyOptional({ description: "Country code. [国家代码]", type: String })
  countryCode?: string | null;

  @ApiPropertyOptional({
    description: "Experience requirement. [经验要求]",
    type: () => ExperienceRequirementResponseDto,
  })
  experienceRequirement?: ExperienceRequirementResponseDto | null;

  @ApiPropertyOptional({
    description: "Salary details. [薪资详情]",
    type: () => SalaryDetailsResponseDto,
  })
  salaryDetails?: SalaryDetailsResponseDto | null;

  @ApiPropertyOptional({
    description: "Job locations list. [地点列表]",
    type: [String],
    isArray: true,
  })
  jobLocations?: string[] | null;

  @ApiPropertyOptional({ description: "Job description. [岗位描述]", type: String })
  jobDescription?: string | null;

  @ApiProperty({ description: "Company name. [公司名称]", type: String })
  companyName!: string;

  @ApiPropertyOptional({ description: "H1B. [H1B]", type: String })
  h1b?: string | null;

  @ApiPropertyOptional({ description: "US citizenship requirement. [美国公民要求]", type: String })
  usCitizenship?: string | null;

  @ApiPropertyOptional({ description: "Level. [级别]", type: String })
  level?: string | null;

  @ApiPropertyOptional({
    description: "AI analysis JSON. [AI分析JSON]",
    type: Object,
  })
  aiAnalysis?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    description: "Supported application types. [支持投递类型]",
    type: [String],
    isArray: true,
  })
  jobApplicationType?: string[] | null;

  @ApiProperty({
    description: "Created time (ISO 8601). [创建时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Updated time (ISO 8601). [更新时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  updatedAt!: string;
}

export class JobApplicationResponseDto {
  @ApiProperty({ description: "Application ID (UUID). [投递ID(UUID)]", type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ description: "Student ID (UUID string). [学生ID(UUID字符串)]", type: String })
  studentId!: string;

  @ApiProperty({ description: "Job ID (UUID). [岗位ID(UUID)]", type: String, format: "uuid" })
  jobId!: string;

  @ApiProperty({
    description: "Application type. [投递类型]",
    type: String,
    example: "referral",
  })
  applicationType!: ApplicationType | string;

  @ApiPropertyOptional({ description: "Cover letter. [求职信]", type: String })
  coverLetter?: string | null;

  @ApiProperty({
    description: "Status. [投递状态]",
    enum: APPLICATION_STATUSES,
    example: "submitted",
  })
  status!: ApplicationStatus;

  @ApiPropertyOptional({
    description: "Assigned mentor ID (UUID string). [分配导师ID(UUID字符串)]",
    type: String,
  })
  assignedMentorId?: string | null;

  @ApiPropertyOptional({
    description: "Recommended by user ID (UUID string). [推荐人ID(UUID字符串)]",
    type: String,
  })
  recommendedBy?: string | null;

  @ApiPropertyOptional({
    description: "Recommended at (ISO 8601). [推荐时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  recommendedAt?: string | null;

  @ApiProperty({
    description: "Submitted at (ISO 8601). [提交时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  submittedAt!: string;

  @ApiProperty({
    description: "Updated at (ISO 8601). [更新时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  updatedAt!: string;

  @ApiPropertyOptional({
    description: "Internal notes. [内部备注]",
    type: String,
  })
  notes?: string | null;
}

class EventEnvelopeResponseDto {
  @ApiProperty({ description: "Event type. [事件类型]", type: String })
  type!: string;

  @ApiProperty({
    description: "Event payload (free-form JSON). [事件载荷(自由结构JSON)]",
    type: Object,
  })
  payload!: Record<string, unknown>;
}

export class JobApplicationServiceResultResponseDto {
  @ApiProperty({
    description: "Main data. [主数据]",
    type: () => JobApplicationResponseDto,
  })
  data!: JobApplicationResponseDto;

  @ApiPropertyOptional({
    description: "Single event (optional). [单个事件(可选)]",
    type: () => EventEnvelopeResponseDto,
  })
  event?: EventEnvelopeResponseDto;

  @ApiPropertyOptional({
    description: "Multiple events (optional). [多个事件(可选)]",
    type: () => EventEnvelopeResponseDto,
    isArray: true,
  })
  events?: EventEnvelopeResponseDto[];
}

export class BatchRecommendReferralApplicationsResponseDto {
  @ApiProperty({
    description: "Created referral applications. [创建的内推投递记录]",
    type: () => JobApplicationResponseDto,
    isArray: true,
  })
  items!: JobApplicationResponseDto[];
}

export class JobQueryResponseDto {
  @ApiProperty({
    description: "Job items. [岗位列表]",
    type: () => JobPositionResponseDto,
    isArray: true,
  })
  data!: JobPositionResponseDto[];

  @ApiProperty({ description: "Total jobs. [总数]", type: Number })
  total!: number;

  @ApiProperty({ description: "Current page. [当前页码]", type: Number })
  page!: number;

  @ApiProperty({ description: "Page size. [每页条数]", type: Number })
  pageSize!: number;

  @ApiProperty({ description: "Total pages. [总页数]", type: Number })
  totalPages!: number;
}

