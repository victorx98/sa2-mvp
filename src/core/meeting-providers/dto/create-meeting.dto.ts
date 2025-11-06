import {
  IsString,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
} from "class-validator";

/**
 * Create Meeting DTO
 *
 * Input for creating a meeting across different platforms
 */
export class CreateMeetingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  topic: string; // Meeting topic

  @IsDateString()
  startTime: string; // Start time (ISO 8601 format)

  @IsInt()
  @Min(15)
  @Max(480)
  duration: number; // Duration in minutes (15 min to 8 hours)

  @IsString()
  @IsOptional()
  hostUserId?: string; // Platform-specific host user ID

  @IsBoolean()
  @IsOptional()
  autoRecord?: boolean; // Enable auto-recording

  @IsBoolean()
  @IsOptional()
  enableWaitingRoom?: boolean; // Enable waiting room (Zoom only)

  @IsBoolean()
  @IsOptional()
  participantJoinEarly?: boolean; // Allow participants to join early
}
