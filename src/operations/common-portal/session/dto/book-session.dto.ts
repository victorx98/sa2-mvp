import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
} from "class-validator";

/**
 * BFF Layer - Book Session Request DTO
 * 职责：定义预约课程的请求参数
 */
export class BookSessionDto {
  @ApiProperty({ description: "学生ID" })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ description: "合同ID" })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({ description: "导师ID" })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({
    description: "开始时间（ISO 8601格式）",
    example: "2024-01-20T10:00:00Z",
  })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ description: "持续时间（分钟）", example: 60 })
  @IsNumber()
  @IsNotEmpty()
  duration: number;

  @ApiProperty({ description: "课程名称" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: "服务ID（可选，不传则使用合同默认服务）",
    required: false,
  })
  @IsString()
  @IsOptional()
  serviceId?: string;

  @ApiProperty({
    description: "会议服务提供商（可选，默认zoom）",
    enum: ["zoom", "teams", "google_meet"],
    required: false,
  })
  @IsString()
  @IsOptional()
  provider?: string;
}
