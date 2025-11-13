import {
  IsDateString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsEnum,
  IsUUID,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { SessionStatus } from "../interfaces/session.interface";

// DTO for meeting time segment
class MeetingTimeSegmentDto {
  @IsDateString()
  startTime: Date;

  @IsDateString()
  endTime: Date;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsDateString()
  scheduledStartTime?: string; // Modify scheduled start time

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  scheduledDuration?: number; // Modify planned duration (30-180 minutes)

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sessionName?: string; // Modify session name

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string; // Modify notes

  @IsOptional()
  @IsUUID()
  contractId?: string; // Modify associated contract ID (for wrong product selection)

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus; // Modify status (limited state transitions)

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeetingTimeSegmentDto)
  meetingTimeList?: Array<{ startTime: Date; endTime: Date }>; // List of meeting time segments (for multi-segment sessions)

  @IsOptional()
  @IsInt()
  @Min(0)
  actualServiceDuration?: number; // Actual service duration in minutes (sum of all meeting segments)
}
