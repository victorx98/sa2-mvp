import { IsOptional, IsString, IsDateString } from 'class-validator';

/**
 * DTO for updating a regular mentoring session
 */
export class UpdateRegularMentoringDto {
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

