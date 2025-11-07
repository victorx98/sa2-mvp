import {
  IsOptional,
  IsArray,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsString,
} from "class-validator";

/**
 * Query Filters DTO
 *
 * Filters for querying sessions
 */
export class QueryFiltersDto {
  @IsOptional()
  @IsArray()
  @IsEnum(["scheduled", "started", "completed", "cancelled"], { each: true })
  status?: string[]; // Status filter

  @IsOptional()
  @IsDateString()
  dateFrom?: string; // Start date

  @IsOptional()
  @IsDateString()
  dateTo?: string; // End date

  @IsOptional()
  @IsBoolean()
  hasRecording?: boolean; // Has recording filter

  @IsOptional()
  @IsBoolean()
  hasTranscript?: boolean; // Has transcript filter

  @IsOptional()
  @IsString()
  keyword?: string; // Keyword search (session name)
}

/**
 * Pagination DTO
 *
 * Pagination parameters
 */
export class PaginationDto {
  @IsOptional()
  page?: number = 1; // Page number (default: 1)

  @IsOptional()
  limit?: number = 20; // Items per page (default: 20)

  @IsOptional()
  @IsString()
  sort?: string = "-scheduledStartTime"; // Sort field (default: -scheduledStartTime)

  @IsOptional()
  @IsEnum(["asc", "desc"])
  order?: "asc" | "desc" = "desc"; // Sort order (default: desc)
}
