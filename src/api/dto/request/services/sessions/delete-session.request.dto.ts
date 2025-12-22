import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum } from 'class-validator';

/**
 * Delete Session Request DTO
 */
export class DeleteSessionRequestDto {
  @ApiProperty({
    description: 'Session Type',
    example: 'regular_mentoring',
    enum: ['regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session'],
  })
  @IsString()
  @IsNotEmpty()
  @IsEnum(['regular_mentoring', 'gap_analysis', 'ai_career', 'comm_session', 'class_session'])
  sessionType: string;
}

