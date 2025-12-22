import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsEnum } from 'class-validator';

/**
 * Update Session Request DTO
 */
export class UpdateSessionRequestDto {
  @ApiProperty({
    description: 'Session Type',
    example: 'regular_mentoring',
    enum: ['regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session'])
  sessionType: string;

  @ApiProperty({
    description: 'Session Title',
    example: 'Resume Coaching',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Session description',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Scheduled Start Time (ISO 8601)',
    example: '2025-12-03T06:00:00Z',
    required: false,
  })
  @IsString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({
    description: 'Session Duration in minutes',
    example: 60,
    required: false,
  })
  @IsInt()
  @Min(15)
  @IsOptional()
  duration?: number;
}

