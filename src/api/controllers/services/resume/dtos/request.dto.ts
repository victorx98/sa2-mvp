import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Upload Resume Request DTO
 */
export class UploadResumeRequestDto {
  @ApiProperty({ description: 'Student user ID' })
  @IsString()
  @IsNotEmpty()
  studentUserId: string;

  @ApiProperty({ description: 'Job title', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  jobTitle: string;

  @ApiProperty({ description: 'Session type', required: false, maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  sessionType?: string;

  @ApiProperty({ description: 'File name', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileName: string;

  @ApiProperty({ description: 'File URL (S3)', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  fileUrl: string;
}

/**
 * Set Final Request DTO
 */
export class SetFinalRequestDto {
  @ApiProperty({ description: 'Description', required: false, maxLength: 1000 })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

/**
 * Bill Resume Request DTO
 */
export class BillResumeRequestDto {
  @ApiProperty({ description: 'Student user ID' })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ description: 'Mentor user ID' })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({ description: 'Service type', required: false })
  @IsString()
  @IsOptional()
  serviceType?: string;

  @ApiProperty({ description: 'Description', required: false, maxLength: 1000 })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

/**
 * Cancel Bill Resume Request DTO
 */
export class CancelBillResumeRequestDto {
  @ApiProperty({ description: 'Service type', required: false })
  @IsString()
  @IsOptional()
  serviceType?: string;

  @ApiProperty({ description: 'Description', required: false, maxLength: 1000 })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

