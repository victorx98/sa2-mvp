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
    description: "Student ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    description: "Mentor ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({
    description: "Contract ID",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({
    description: "Service ID",
    example: "service-1v1-session",
  })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({
    description: "Session start time (ISO 8601 format)",
    example: "2025-11-10T14:00:00Z",
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledStartTime: string;

  @ApiProperty({
    description: "Session end time (ISO 8601 format)",
    example: "2025-11-10T15:00:00Z",
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledEndTime: string;

  @ApiProperty({
    description: "Session duration (minutes)",
    example: 60,
  })
  @IsInt()
  @Min(15)
  duration: number;

  @ApiProperty({
    description: "Session topic",
    example: "Resume review guidance",
  })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({
    description: "Meeting provider",
    example: "zoom",
    required: false,
  })
  @IsString()
  @IsOptional()
  meetingProvider?: string;
}
