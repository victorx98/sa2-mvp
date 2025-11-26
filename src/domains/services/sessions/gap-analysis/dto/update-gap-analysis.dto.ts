import { IsOptional, IsString, IsDateString } from 'class-validator';

/**
 * DTO for updating a gap analysis session
 */
export class UpdateGapAnalysisDto {
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

