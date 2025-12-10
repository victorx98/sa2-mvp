import { IsOptional, IsString, IsDateString, IsInt, Min } from 'class-validator';

/**
 * DTO for updating a class
 */
export class UpdateClassDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalSessions?: number;
}
