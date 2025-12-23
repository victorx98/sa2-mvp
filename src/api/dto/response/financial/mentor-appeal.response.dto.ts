import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * User Summary DTO
 * [用户摘要DTO]
 */
export class UserSummaryDto {
  @ApiProperty({
    description: "User ID (UUID). [用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  id!: string;

  @ApiProperty({
    description: "Chinese name. [中文名]",
    type: String,
  })
  name_cn!: string;

  @ApiProperty({
    description: "English name. [英文名]",
    type: String,
  })
  name_en!: string;
}

export class MentorAppealResponseDto {
  @ApiProperty({
    description: "Appeal ID (UUID). [申诉ID(UUID)]",
    type: String,
    format: "uuid",
  })
  id!: string;

  @ApiProperty({
    description: "Mentor ID (UUID). [导师ID(UUID)]",
    type: String,
    format: "uuid",
  })
  mentorId!: string;

  @ApiProperty({
    description: "Counselor ID (UUID). [顾问ID(UUID)]",
    type: String,
    format: "uuid",
  })
  counselorId!: string;

  @ApiPropertyOptional({
    description: "Mentor payable ledger ID (UUID). [关联应付账款ID(UUID)]",
    type: String,
    format: "uuid",
  })
  mentorPayableId?: string;

  @ApiPropertyOptional({
    description: "Settlement ledger ID (UUID). [关联结算ID(UUID)]",
    type: String,
    format: "uuid",
  })
  settlementId?: string;

  @ApiProperty({
    description: "Appeal type. [申诉类型]",
    type: String,
    example: "billing_error",
  })
  appealType!: string;

  @ApiProperty({
    description:
      "Appeal amount as decimal string (DB numeric). [申诉金额(字符串，DB numeric)]",
    type: String,
    example: "100.00",
  })
  appealAmount!: string;

  @ApiProperty({
    description: "Currency (ISO 4217). [币种(ISO 4217)]",
    type: String,
    example: "USD",
  })
  currency!: string;

  @ApiProperty({
    description: "Appeal reason. [申诉理由]",
    type: String,
  })
  reason!: string;

  @ApiPropertyOptional({
    description: "Service title (redundant field from service_references). [服务标题(从service_references冗余)]",
    type: String,
  })
  title?: string;

  @ApiProperty({
    description: "Status (PENDING/APPROVED/REJECTED). [状态：待处理/已批准/已驳回]",
    type: String,
    example: "PENDING",
  })
  status!: string;

  @ApiPropertyOptional({
    description: "Rejection reason. [驳回理由]",
    type: String,
  })
  rejectionReason?: string;

  @ApiPropertyOptional({
    description: "Processing comments. [处理备注]",
    type: String,
  })
  comments?: string;

  @ApiPropertyOptional({
    description: "Approved by user ID (UUID). [审批人用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  approvedBy?: string;

  @ApiPropertyOptional({
    description: "Approved time (ISO 8601). [审批时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  approvedAt?: string;

  @ApiPropertyOptional({
    description: "Rejected by user ID (UUID). [驳回人用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  rejectedBy?: string;

  @ApiPropertyOptional({
    description: "Rejected time (ISO 8601). [驳回时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  rejectedAt?: string;

  @ApiProperty({
    description: "Created by user ID (UUID). [创建人用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  createdBy!: string;

  @ApiProperty({
    description: "Created time (ISO 8601). [创建时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  createdAt!: string;
}

/**
 * Mentor Appeal with Relations Response DTO
 * [包含关联信息的导师申诉响应DTO]
 */
export class MentorAppealWithRelationsResponseDto {
  @ApiProperty({
    description: "Appeal ID (UUID). [申诉ID(UUID)]",
    type: String,
    format: "uuid",
  })
  id!: string;

  @ApiProperty({
    description: "Service title. [服务标题]",
    type: String,
  })
  title!: string;

  @ApiProperty({
    description: "Appeal type. [申诉类型]",
    type: String,
    example: "billing_error",
  })
  appealType!: string;

  @ApiProperty({
    description: "Appeal amount. [申诉金额]",
    type: String,
    example: "100.00",
  })
  appealAmount!: string;

  @ApiProperty({
    description: "Currency (ISO 4217). [币种(ISO 4217)]",
    type: String,
    example: "USD",
  })
  currency!: string;

  @ApiProperty({
    description: "Status (PENDING/APPROVED/REJECTED). [状态：待处理/已批准/已驳回]",
    type: String,
    example: "PENDING",
  })
  status!: string;

  @ApiProperty({
    description: "Counselor information. [顾问信息]",
    type: UserSummaryDto,
  })
  counselor!: UserSummaryDto;

  @ApiProperty({
    description: "Mentor information. [导师信息]",
    type: UserSummaryDto,
  })
  mentor!: UserSummaryDto;

  @ApiPropertyOptional({
    description: "Student information. [学生信息]",
    type: UserSummaryDto,
  })
  student?: UserSummaryDto | null;

  @ApiProperty({
    description: "Created time (ISO 8601). [创建时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  createdAt!: string;

  @ApiPropertyOptional({
    description: "Approved time (ISO 8601). [审批时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  approvedAt?: string;

  @ApiPropertyOptional({
    description: "Rejected time (ISO 8601). [驳回时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  rejectedAt?: string;

  @ApiPropertyOptional({
    description: "Rejection reason. [驳回理由]",
    type: String,
  })
  rejectionReason?: string;

  @ApiProperty({
    description: "Updated by name. [更新人姓名]",
    type: String,
  })
  updatedByName!: string;

  @ApiProperty({
    description: "Updated time (ISO 8601). [更新时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  updatedAt!: string;
}

/**
 * Paginated Mentor Appeal Response DTO
 * [分页导师申诉响应DTO]
 */
export class PaginatedMentorAppealResponseDto {
  @ApiProperty({
    description: "Appeal list. [申诉列表]",
    type: MentorAppealWithRelationsResponseDto,
    isArray: true,
  })
  data!: MentorAppealWithRelationsResponseDto[];

  @ApiProperty({
    description: "Total count. [总数]",
    type: Number,
    example: 100,
  })
  total!: number;

  @ApiProperty({
    description: "Current page. [当前页码]",
    type: Number,
    example: 1,
  })
  page!: number;

  @ApiProperty({
    description: "Page size. [每页条数]",
    type: Number,
    example: 20,
  })
  pageSize!: number;

  @ApiProperty({
    description: "Total pages. [总页数]",
    type: Number,
    example: 5,
  })
  totalPages!: number;
}

