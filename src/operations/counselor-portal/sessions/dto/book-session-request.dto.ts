import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  Min,
  IsOptional,
} from "class-validator";

/**
 * Operations Layer - Book Session Request DTO
 * 顾问预约会话的请求DTO（前端提交的数据）
 */
export class BookSessionRequestDto {
  @ApiProperty({
    description: "学生ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    description: "导师ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({
    description: "合同ID",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({
    description: "服务ID",
    example: "service-1v1-session",
  })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({
    description: "预约开始时间（ISO 8601格式）",
    example: "2025-11-10T14:00:00Z",
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledStartTime: string;

  @ApiProperty({
    description: "预约结束时间（ISO 8601格式）",
    example: "2025-11-10T15:00:00Z",
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledEndTime: string;

  @ApiProperty({
    description: "会话时长（分钟）",
    example: 60,
  })
  @IsInt()
  @Min(15)
  duration: number;

  @ApiProperty({
    description: "会话主题",
    example: "简历修改指导",
  })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({
    description: "会议服务提供商",
    example: "zoom",
    required: false,
  })
  @IsString()
  @IsOptional()
  meetingProvider?: string;
}
