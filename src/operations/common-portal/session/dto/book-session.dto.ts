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
    description: "Service ID (optional, defaults to the contract service)",
    required: false,
  })
  @IsString()
  @IsOptional()
  serviceId?: string;

  @ApiProperty({
    description: "Meeting provider (optional, defaults to zoom)",
    enum: ["zoom", "teams", "google_meet"],
    required: false,
  })
  @IsString()
  @IsOptional()
  provider?: string;
}
