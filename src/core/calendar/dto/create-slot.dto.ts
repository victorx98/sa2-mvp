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
} from "class-validator";
import { UserType, SlotType } from "../interfaces/calendar-slot.interface";

/**
 * DTO for creating a calendar slot
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
   * Slot type (session/class_session)
   */
  @IsEnum(SlotType)
  slotType: SlotType;

  /**
   * Reason for blocking or remarks (optional, max 255 characters)
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
