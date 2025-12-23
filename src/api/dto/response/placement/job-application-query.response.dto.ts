import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { APPLICATION_STATUSES } from "@domains/placement/types/application-status.types";
import type { ApplicationStatus, ApplicationType } from "@domains/placement/types";

/**
 * User info DTO [用户信息DTO]
 * Format: {id: string, name_cn: string, name_en: string}
 */
class UserInfoDto {
  @ApiProperty({ description: "User ID (UUID). [用户ID(UUID)]", type: String, format: "uuid" })
  id!: string;

  @ApiPropertyOptional({ description: "Chinese name. [中文名]", type: String })
  name_cn?: string | null;

  @ApiPropertyOptional({ description: "English name. [英文名]", type: String })
  name_en?: string | null;
}

/**
 * Job application query item DTO [投递申请查询项DTO]
 */
export class JobApplicationQueryItemDto {
  @ApiProperty({ description: "Application ID (UUID). [投递ID(UUID)]", type: String, format: "uuid" })
  id!: string;

  @ApiProperty({ description: "Student ID (UUID string). [学生ID(UUID字符串)]", type: String })
  studentId!: string;

  @ApiPropertyOptional({ description: "Recommended job ID (UUID). [推荐岗位ID(UUID)]", type: String, format: "uuid" })
  recommendedJobId?: string | null;

  @ApiProperty({
    description: "Application type. [投递类型]",
    type: String,
    example: "referral",
  })
  applicationType!: ApplicationType | string;

  @ApiPropertyOptional({ description: "Cover letter. [求职信]", type: String })
  coverLetter?: string | null;

  @ApiPropertyOptional({ description: "Custom answers. [自定义答案]", type: Object })
  customAnswers?: Record<string, unknown> | null;

  @ApiProperty({
    description: "Status. [投递状态]",
    enum: APPLICATION_STATUSES,
    example: "submitted",
  })
  status!: ApplicationStatus;

  @ApiPropertyOptional({ description: "Result. [结果]", type: String })
  result?: string | null;

  @ApiPropertyOptional({ description: "Result reason. [结果原因]", type: String })
  resultReason?: string | null;

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

  @ApiPropertyOptional({ description: "Notes. [备注]", type: String })
  notes?: string | null;

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

  @ApiPropertyOptional({ description: "Object ID. [对象ID]", type: String })
  objectId?: string | null;

  @ApiPropertyOptional({ description: "Job ID. [岗位ID]", type: String })
  jobId?: string | null;

  @ApiPropertyOptional({ description: "Job link. [岗位链接]", type: String })
  jobLink?: string | null;

  @ApiPropertyOptional({ description: "Job type. [职位类型]", type: String })
  jobType?: string | null;

  @ApiPropertyOptional({ description: "Job title. [职位标题]", type: String })
  jobTitle?: string | null;

  @ApiPropertyOptional({ description: "Company name. [公司名称]", type: String })
  companyName?: string | null;

  @ApiPropertyOptional({ description: "Location. [工作地点]", type: String })
  location?: string | null;

  @ApiPropertyOptional({ description: "Job categories. [职位类别]", type: [String] })
  jobCategories?: string[] | null;

  @ApiPropertyOptional({ description: "Normalized job title. [标准化职位标题]", type: String })
  normalJobTitle?: string | null;

  @ApiPropertyOptional({ description: "Level. [级别]", type: String })
  level?: string | null;

  // Related user information [关联用户信息]
  @ApiProperty({
    description: "Student information. [学生信息]",
    type: () => UserInfoDto,
  })
  student!: UserInfoDto;

  @ApiPropertyOptional({
    description: "Mentor information. [导师信息]",
    type: () => UserInfoDto,
  })
  mentor?: UserInfoDto | null;

  @ApiPropertyOptional({
    description: "Counselor information. [顾问信息]",
    type: () => UserInfoDto,
  })
  counselor?: UserInfoDto | null;
}

/**
 * Job application query response DTO [投递申请查询响应DTO]
 */
export class JobApplicationQueryResponseDto {
  @ApiProperty({
    description: "Job application items. [投递申请列表]",
    type: () => JobApplicationQueryItemDto,
    isArray: true,
  })
  data!: JobApplicationQueryItemDto[];

  @ApiProperty({ description: "Total applications. [总数]", type: Number })
  total!: number;

  @ApiProperty({ description: "Current page. [当前页码]", type: Number })
  page!: number;

  @ApiProperty({ description: "Page size. [每页条数]", type: Number })
  pageSize!: number;

  @ApiProperty({ description: "Total pages. [总页数]", type: Number })
  totalPages!: number;
}

