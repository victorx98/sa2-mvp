import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

/**
 * Cancel Session Request DTO
 */
export class CancelSessionRequestDto {
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
    description: 'Session Description',
    example: 'Cancelled by counselor',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

