import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

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

