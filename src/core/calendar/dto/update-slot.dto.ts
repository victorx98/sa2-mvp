import {
  IsOptional,
  IsString,
  MaxLength,
  IsDate,
  IsInt,
  Min,
  Max,
  IsObject,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import {
  SessionType,
  SlotStatus,
  ICalendarMetadata,
} from "../interfaces/calendar-slot.interface";

/**
 * DTO for updating a calendar slot (v5.3)
 * Supports partial updates - only provided fields will be updated
 */
export class UpdateSlotDto {
  /**
   * Course title (optional)
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  /**
   * Scheduled start time (optional)
   */
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  scheduledStartTime?: Date;

  /**
   * Duration in minutes (optional, 30-180)
   */
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  durationMinutes?: number;

  /**
   * Metadata - snapshot data (optional, partial update supported)
   */
  @IsOptional()
  @IsObject()
  metadata?: Partial<ICalendarMetadata>;

  /**
   * Session type (optional)
   */
  @IsOptional()
  @IsEnum(SessionType)
  sessionType?: SessionType;

  /**
   * Status (optional) - booked/completed/cancelled
   */
  @IsOptional()
  @IsEnum(SlotStatus)
  status?: SlotStatus;
}

