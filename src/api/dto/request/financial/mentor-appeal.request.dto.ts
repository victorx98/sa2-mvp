import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

/**
 * Create Mentor Appeal Request DTO (创建导师申诉请求DTO)
 * 
 * Note: mentorId is NOT included in this DTO as it is automatically extracted from the JWT token for security.
 * (注意：mentorId不包含在此DTO中，因为它会自动从JWT token中提取以确保安全)
 */
export class CreateMentorAppealRequestDto {
  @ApiProperty({
    description:
      "Counselor ID (UUID). The assigned counselor to process the appeal. [顾问ID(UUID)，负责处理该申诉]",
    type: String,
    format: "uuid",
    required: true,
  })
  @IsUUID()
  @IsNotEmpty()
  counselorId!: string;

  @ApiProperty({
    description:
      "Student ID (UUID). The student related to this appeal. [学生ID(UUID)，关联的学生]",
    type: String,
    format: "uuid",
    required: true,
  })
  @IsUUID()
  @IsNotEmpty()
  studentId!: string;

  @ApiPropertyOptional({
    description:
      "Mentor payable ledger ID (UUID). Optional linkage to the disputed payable record. [关联应付账款ID(UUID，可选)，关联被争议账款]",
    type: String,
    format: "uuid",
    required: false,
  })
  @IsUUID()
  @IsOptional()
  mentorPayableId?: string;

  @ApiPropertyOptional({
    description:
      "Service title. Redundant field from service_references for query optimization. No uniqueness validation is performed on this field. [服务标题，从service_references冗余，用于查询优化。此字段不进行唯一性验证]",
    type: String,
    required: false,
    example: "Resume Revision",
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiProperty({
    description:
      "Appeal type (billing_error/missing_service/price_dispute/other). [申诉类型：费用错误/遗漏服务/价格争议/其他]",
    type: String,
    required: true,
    example: "billing_error",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  appealType!: string;

  @ApiProperty({
    description:
      "Appeal amount as string to match database numeric type. [申诉金额(字符串，匹配数据库numeric)]",
    type: String,
    required: true,
    example: "100.00",
  })
  @IsString()
  @IsNotEmpty()
  appealAmount!: string;

  @ApiProperty({
    description:
      "Currency (ISO 4217 3-letter code). [币种(ISO 4217 三位码)]",
    type: String,
    required: true,
    example: "USD",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency!: string;

  @ApiProperty({
    description:
      "Appeal reason. Provide detailed context and evidence references. [申诉理由，需提供充分上下文与证据线索]",
    type: String,
    required: true,
    example: "The payable ledger amount is incorrect for session #123.",
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ApproveMentorAppealRequestDto {
  @ApiPropertyOptional({
    description:
      "New appeal amount (number). Only used when the original amount is invalid. [新申诉金额(数值)，仅在原金额无效时使用]",
    type: Number,
    required: false,
    example: 100,
  })
  @IsNumber()
  @IsOptional()
  appealAmount?: number;

  @ApiPropertyOptional({
    description:
      "New currency (ISO 4217). Only used when the original currency is invalid. [新币种(ISO 4217)，仅在原币种无效时使用]",
    type: String,
    required: false,
    example: "USD",
  })
  @IsString()
  @IsOptional()
  @Matches(/^[A-Z]{3}$/, {
    message:
      "currency must be a valid ISO 4217 3-letter code [currency必须是合法的ISO 4217三位码]",
  })
  currency?: string;

  @ApiPropertyOptional({
    description:
      "Approval comments (optional). [批准备注(可选)]",
    type: String,
    required: false,
    example: "Approved after manual verification.",
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  comments?: string;
}

export class RejectMentorAppealRequestDto {
  @ApiProperty({
    description:
      "Rejection reason. Required when rejecting. [驳回理由，驳回时必填]",
    type: String,
    required: true,
    example: "Insufficient evidence provided.",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  rejectionReason!: string;
}


// Type aliases for backward compatibility
export type CreateAppealDto = CreateMentorAppealRequestDto;
export type ApproveAppealDto = ApproveMentorAppealRequestDto;
export type RejectAppealDto = RejectMentorAppealRequestDto;
