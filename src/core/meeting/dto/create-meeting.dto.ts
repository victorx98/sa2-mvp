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
  IsEnum,
} from "class-validator";
import { MeetingProviderType } from "../providers/provider.interface";

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

  @IsEnum(MeetingProviderType)
  @IsOptional()
  provider?: MeetingProviderType; // Meeting provider (defaults to system default)

  @IsString()
  @IsOptional()
  hostUserId?: string; // Platform-specific host user ID

  @IsBoolean()
  @IsOptional()
  autoRecord?: boolean; // Enable auto-recording (passed to provider, not saved in DB)

  @IsBoolean()
  @IsOptional()
  enableWaitingRoom?: boolean; // Enable waiting room (Zoom only)

  @IsBoolean()
  @IsOptional()
  participantJoinEarly?: boolean; // Allow participants to join early
}

