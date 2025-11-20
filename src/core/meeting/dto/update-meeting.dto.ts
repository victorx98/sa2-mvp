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
 * Update Meeting DTO
 *
 * Input for updating an existing meeting
 */
export class UpdateMeetingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @IsOptional()
  topic?: string; // Meeting topic

  @IsDateString()
  @IsOptional()
  startTime?: string; // Start time (ISO 8601 format)

  @IsInt()
  @Min(15)
  @Max(480)
  @IsOptional()
  duration?: number; // Duration in minutes (15 min to 8 hours)

  @IsBoolean()
  @IsOptional()
  autoRecord?: boolean; // Enable auto-recording
}

