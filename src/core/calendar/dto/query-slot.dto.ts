import { IsUUID, IsEnum, IsDateString, IsOptional } from "class-validator";
import { ResourceType } from "../interfaces/calendar-slot.interface";

export class QuerySlotDto {
  @IsEnum(ResourceType)
  resourceType: ResourceType; // Resource type

  @IsUUID()
  resourceId: string; // Resource ID

  @IsOptional()
  @IsDateString()
  dateFrom?: string; // Query start date

  @IsOptional()
  @IsDateString()
  dateTo?: string; // Query end date
}
