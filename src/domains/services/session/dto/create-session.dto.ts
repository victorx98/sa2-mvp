import {
  IsUUID,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
} from "class-validator";
import { MeetingProvider } from "../interfaces/session.interface";

export class CreateSessionDto {
  @IsUUID()
  studentId: string; // Student user ID

  @IsUUID()
  mentorId: string; // Mentor user ID

  @IsDateString()
  scheduledStartTime: string; // Planned start time (ISO 8601 format)

  @IsInt()
  @Min(30)
  @Max(180)
  scheduledDuration: number; // Planned duration in minutes (30-180)

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sessionName?: string; // Session name (optional, auto-generated if not provided)

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string; // Notes (optional)

  @IsOptional()
  @IsEnum(MeetingProvider)
  meetingProvider?: MeetingProvider; // Meeting platform (default from system config)

  @IsOptional()
  @IsUUID()
  contractId?: string; // Associated contract ID (optional, for billing)

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serviceType?: string; // Service type identifier (optional)
}
