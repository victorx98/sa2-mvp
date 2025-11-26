import {
  IsUUID,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  IsObject,
} from "class-validator";
import { 
  UserType, 
  SessionType,
  ICalendarMetadata 
} from "../interfaces/calendar-slot.interface";

/**
 * DTO for creating a calendar slot (v5.3 extended)
 * Represents user input for booking or creating a time slot
 */
export class CreateSlotDto {
  /**
   * User ID (UUID)
   */
  @IsUUID()
  userId: string;

  /**
   * User type (mentor/student/counselor)
   */
  @IsEnum(UserType)
  userType: UserType;

  /**
   * Start time in ISO 8601 format
   */
  @IsDateString()
  startTime: string;

  /**
   * Duration in minutes (30-180)
   */
  @IsInt()
  @Min(30)
  @Max(180)
  durationMinutes: number;

  /**
   * Associated session ID (optional)
   */
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  /**
   * Associated meeting ID (optional)
   */
  @IsOptional()
  @IsUUID()
  meetingId?: string;

  /**
   * Session type - regular_mentoring/gap_analysis/ai_career/comm_session/class_session
   */
  @IsEnum(SessionType)
  sessionType: SessionType;

  /**
   * Course title (v5.3)
   */
  @IsString()
  @MaxLength(255)
  title: string;

  /**
   * Metadata (v5.3) - snapshot data (optional)
   */
  @IsOptional()
  @IsObject()
  metadata?: ICalendarMetadata;

  /**
   * Reason for blocking or remarks (optional, max 255 characters)
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
