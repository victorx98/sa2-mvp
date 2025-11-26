import { IsOptional, IsString, IsDateString } from 'class-validator';

/**
 * DTO for updating an AI career session
 */
export class UpdateAiCareerDto {
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

