import {
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  Min,
  Max,
  IsEnum,
} from "class-validator";
import { MentoringSessionStatus } from "../entities/mentoring-session.entity";

/**
 * Update Mentoring Session DTO
 *
 * Used to update mentoring session business fields
 * Does not include meeting-related fields (managed by Core Layer)
 */
export class UpdateMentoringDto {
  @IsOptional()
  @IsEnum(MentoringSessionStatus)
  status?: MentoringSessionStatus; // Update business status

  @IsOptional()
  @IsInt()
  @Min(0)
  serviceDuration?: number; // Service duration in seconds (for billing)

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string; // Mentor feedback text

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number; // Student rating (1-5)

  @IsOptional()
  @IsString()
  @MaxLength(255)
  topic?: string; // Session topic

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string; // Additional notes
}

