import {
  IsString,
  IsOptional,
  MaxLength,
} from "class-validator";

/**
 * Cancel Meeting DTO (v4.1)
 *
 * Input for cancelling an existing meeting
 */
export class CancelMeetingDto {
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string; // Cancellation reason (optional)
}

