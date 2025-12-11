import { IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';

/**
 * DTO for updating a class session
 */
export class UpdateClassSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsUUID()
  mentorUserId?: string;
}
