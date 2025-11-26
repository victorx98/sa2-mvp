import { IsOptional, IsBoolean, IsEnum, IsDateString } from 'class-validator';
import { SessionStatus } from '../enums/session-type.enum';

/**
 * DTO for session query filters
 */
export class SessionFiltersDto {
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsBoolean()
  excludeDeleted?: boolean = true; // Default: exclude deleted sessions

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}

