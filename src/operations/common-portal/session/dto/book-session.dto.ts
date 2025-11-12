import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
  IsEnum,
} from "class-validator";
import { ServiceType } from "@domains/contract/common/types/enum.types";
import { serviceTypeEnum } from "@infrastructure/database/schema/services.schema";

/**
 * BFF Layer - Book Session Request DTO
 * 职责：定义预约课程的请求参数
 */
export class BookSessionDto {
  @ApiProperty({ description: "Student ID" })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ description: "Contract ID" })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({ description: "Mentor ID" })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({
    description: "Start time (ISO 8601 format)",
    example: "2024-01-20T10:00:00Z",
  })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ description: "Duration (minutes)", example: 60 })
  @IsNumber()
  @IsNotEmpty()
  duration: number;

  @ApiProperty({ description: "Session name" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description:
      "Service type (e.g., gap_analysis, individual_session, mock_interview)",
    enum: [
      "gap_analysis",
      "resume_review",
      "recommendation_letter",
      "recommendation_letter_online",
      "session",
      "mock_interview",
      "class_session",
      "internal_referral",
      "contract_signing_assistance",
      "proxy_application",
      "other_service",
    ],
    required: false,
  })
  @IsEnum(serviceTypeEnum.enumValues)
  @IsOptional()
  serviceType?: ServiceType;

  @ApiProperty({
    description: "Meeting provider (optional, defaults to zoom)",
    enum: ["zoom", "teams", "google_meet", "feishu"],
    required: false,
  })
  @IsString()
  @IsOptional()
  provider?: string;
}
