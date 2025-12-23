import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Create Mock Interview Request DTO
 */
export class CreateMockInterviewRequestDto {
  @ApiProperty({
    description: 'Student ID',
    example: '9e50af7d-5f08-4516-939f-7f765ce131b8',
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    description: 'Interview Title',
    example: 'Google Software Engineer Mock Interview',
  })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    description: 'Scheduled Start Time (ISO 8601)',
    example: '2025-12-25T10:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;

  @ApiProperty({
    description: 'Interview Duration in minutes',
    example: 60,
    required: false,
  })
  @IsInt()
  @Min(15)
  @IsOptional()
  @Transform(({ obj }) => obj.duration || 60)
  duration?: number;

  @ApiProperty({
    description: 'Interview Type (behavioral/technical/case)',
    example: 'technical',
    required: false,
  })
  @IsString()
  @IsOptional()
  interviewType?: string;

  @ApiProperty({
    description: 'Interview Language',
    example: 'en',
    required: false,
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({
    description: 'Target Company Name',
    example: 'Google',
    required: false,
  })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({
    description: 'Target Job Title',
    example: 'Software Engineer',
    required: false,
  })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiProperty({
    description: 'Job Description',
    example: 'Full stack software engineer position...',
    required: false,
  })
  @IsString()
  @IsOptional()
  jobDescription?: string;

  @ApiProperty({
    description: 'Resume Text',
    example: 'John Doe\nSoftware Engineer...',
    required: false,
  })
  @IsString()
  @IsOptional()
  resumeText?: string;

  @ApiProperty({
    description: 'Interview Instructions',
    example: 'Focus on system design and algorithms',
    required: false,
  })
  @IsString()
  @IsOptional()
  interviewInstructions?: string;

  @ApiProperty({
    description: 'AI System Instruction',
    example: 'Act as a senior technical interviewer...',
    required: false,
  })
  @IsString()
  @IsOptional()
  systemInstruction?: string;
}

/**
 * Update Mock Interview Request DTO
 */
export class UpdateMockInterviewRequestDto {
  @ApiProperty({
    description: 'Interview Title',
    example: 'Google Software Engineer Mock Interview',
    required: false,
  })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({
    description: 'Scheduled Start Time (ISO 8601)',
    example: '2025-12-25T10:00:00Z',
    required: false,
  })
  @IsString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({
    description: 'Interview Duration in minutes',
    example: 60,
    required: false,
  })
  @IsInt()
  @Min(15)
  @IsOptional()
  duration?: number;

  @ApiProperty({
    description: 'Interview Type',
    example: 'technical',
    required: false,
  })
  @IsString()
  @IsOptional()
  interviewType?: string;

  @ApiProperty({
    description: 'Interview Language',
    example: 'en',
    required: false,
  })
  @IsString()
  @IsOptional()
  language?: string;

  @ApiProperty({
    description: 'Target Company Name',
    example: 'Google',
    required: false,
  })
  @IsString()
  @IsOptional()
  companyName?: string;

  @ApiProperty({
    description: 'Target Job Title',
    example: 'Software Engineer',
    required: false,
  })
  @IsString()
  @IsOptional()
  jobTitle?: string;

  @ApiProperty({
    description: 'Job Description',
    example: 'Full stack software engineer position...',
    required: false,
  })
  @IsString()
  @IsOptional()
  jobDescription?: string;

  @ApiProperty({
    description: 'Resume Text',
    example: 'John Doe\nSoftware Engineer...',
    required: false,
  })
  @IsString()
  @IsOptional()
  resumeText?: string;

  @ApiProperty({
    description: 'Interview Instructions',
    example: 'Focus on system design and algorithms',
    required: false,
  })
  @IsString()
  @IsOptional()
  interviewInstructions?: string;
}

