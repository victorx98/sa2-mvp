import { IsUUID, IsEnum, IsOptional, IsISO8601 } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Request DTO for getting calendar events
 */
export class GetCalendarEventsRequestDto {
  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'User type',
    enum: ['mentor', 'student', 'counselor'],
    example: 'mentor',
  })
  @IsEnum(['mentor', 'student', 'counselor'])
  userType: 'mentor' | 'student' | 'counselor';

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601 format)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601 format, max 90 days from start)',
    example: '2025-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;
}

