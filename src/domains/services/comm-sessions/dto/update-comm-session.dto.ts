import { IsOptional, IsString, IsDateString } from 'class-validator';

/**
 * Update Comm Session DTO
 *
 * Supports updating: title, description, scheduledAt
 */
export class UpdateCommSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

