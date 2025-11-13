import { IsUUID, IsEnum, IsDateString, IsOptional } from "class-validator";
import { UserType } from "../interfaces/calendar-slot.interface";

/**
 * DTO for querying calendar slots
 * Used to fetch booked slots for a user within a date range
 */
export class QuerySlotDto {
  /**
   * User type (mentor/student/counselor)
   */
  @IsEnum(UserType)
  userType: UserType;

  /**
   * User ID (UUID)
   */
  @IsUUID()
  userId: string;

  /**
   * Query start date (ISO 8601 format, optional)
   */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /**
   * Query end date (ISO 8601 format, optional, default 90 days from now)
   */
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
