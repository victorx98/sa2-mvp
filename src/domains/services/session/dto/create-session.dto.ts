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
  IsUrl,
} from "class-validator";
import { MeetingProvider } from "../interfaces/session.interface";

export class CreateSessionDto {
  // Base fields
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
  @IsUUID()
  contractId?: string; // Associated contract ID (optional, for billing)

  // Meeting information fields (integrated from MeetingInfoDto)
  @IsOptional()
  @IsEnum(MeetingProvider)
  meetingProvider?: MeetingProvider; // Meeting platform (from MeetingProvider.createMeeting())

  @IsOptional()
  @IsString()
  @MaxLength(20)
  meetingNo?: string; // Feishu meeting number (9 digits) - key field for webhook association

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  meetingUrl?: string; // Meeting link (from MeetingProvider.createMeeting())

  @IsOptional()
  @IsString()
  @MaxLength(50)
  meetingPassword?: string; // Meeting password (optional, from MeetingProvider.createMeeting())

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serviceType?: string; // Service type identifier (optional)
}
