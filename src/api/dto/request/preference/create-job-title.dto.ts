import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

/**
 * Create Job Title Request DTO
 * 创建岗位名称请求(Create Job Title Request)
 */
export class CreateJobTitleDto {
  @ApiProperty({
    description: 'Job title ID (unique identifier)',
    example: 'senior_software_engineer',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  id: string;

  @ApiProperty({
    description: 'Job title description',
    example: 'Senior Software Engineer with 5+ years experience',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Job category ID',
    example: 'software_engineer',
    required: false,
  })
  @IsString()
  @IsOptional()
  jobCategoryId?: string;
}

