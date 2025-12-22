import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Upload Recommendation Letter Request DTO
 */
export class UploadRecommLetterRequestDto {
  @ApiProperty({ description: 'Student user ID' })
  @IsString()
  @IsNotEmpty()
  studentUserId: string;

  @ApiProperty({ description: 'Letter Type ID' })
  @IsString()
  @IsNotEmpty()
  letterTypeId: string;

  @ApiProperty({ description: 'Package Type ID', required: false })
  @IsString()
  @IsOptional()
  packageTypeId?: string;

  @ApiProperty({ description: 'Service type', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  serviceType: string;

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

