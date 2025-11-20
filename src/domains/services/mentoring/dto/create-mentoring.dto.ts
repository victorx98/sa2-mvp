import {
  IsUUID,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

/**
 * Create Mentoring Session DTO
 *
 * Used by Application Layer to create a new mentoring session
 * Requires meetingId from Core Layer (returned by Step 1 of booking flow)
 */
export class CreateMentoringDto {
  @IsUUID()
  meetingId: string; // Meeting ID from Core Layer (FK reference)

  @IsUUID()
  studentId: string; // Student user ID

  @IsUUID()
  mentorId: string; // Mentor user ID

  @IsOptional()
  @IsString()
  @MaxLength(255)
  topic?: string; // Session topic (optional)

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string; // Additional notes (optional)
}

