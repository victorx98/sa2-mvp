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
import { ResourceType, SlotType } from "../interfaces/calendar-slot.interface";

export class CreateSlotDto {
  @IsEnum(ResourceType)
  resourceType: ResourceType; // Resource type

  @IsUUID()
  resourceId: string; // Resource ID

  @IsDateString()
  startTime: string; // Start time (ISO 8601 format)

  @IsInt()
  @Min(30)
  @Max(180)
  durationMinutes: number; // Duration in minutes (30-180)

  @IsOptional()
  @IsUUID()
  sessionId?: string; // Associated session ID (for session type slots)

  @IsEnum(SlotType)
  slotType: SlotType; // Slot type

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string; // Reason for blocking (for blocked type slots)
}
