import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Create Class Session Request DTO
 */
export class CreateClassSessionRequestDto {
  @ApiProperty({
    description: 'Class ID',
    example: 'class-uuid-123',
  })
  @IsString()
  @IsNotEmpty()
  classId: string;

  @ApiProperty({
    description: 'Mentor ID',
    example: '4903b94b-67cc-42a1-9b3e-91ebc51bcefc',
  })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({
    description: 'Session Title',
    example: 'Week 1 - Career Planning Basics',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Introduction to career planning fundamentals',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Scheduled Start Time (ISO 8601)',
    example: '2025-12-03T06:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;

  @ApiProperty({
    description: 'Session Duration in minutes',
    example: 60,
    required: false,
  })
  @IsInt()
  @Min(15)
  @IsOptional()
  @Transform(({ obj }) => obj.duration || 60)
  duration?: number;

  @ApiProperty({
    description: 'Meeting Provider',
    example: 'feishu',
    required: false,
  })
  @IsString()
  @IsOptional()
  meetingProvider?: string;
}

/**
 * Update Class Session Request DTO
 */
export class UpdateClassSessionRequestDto {
  @ApiProperty({
    description: 'Session Title',
    example: 'Week 1 - Career Planning Basics',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Session Description',
    example: 'Introduction to career planning fundamentals',
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
  @IsDateString()
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

/**
 * Cancel Class Session Request DTO
 */
export class CancelClassSessionRequestDto {
  @ApiProperty({
    description: 'Cancellation reason',
    example: 'Mentor unavailable',
    required: false,
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

