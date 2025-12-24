import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

/**
 * Create Job Category Request DTO
 * 创建岗位类别请求(Create Job Category Request)
 */
export class CreateJobCategoryDto {
  @ApiProperty({
    description: 'Job category ID (unique identifier)',
    example: 'software_engineer',
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  id: string;

  @ApiProperty({
    description: 'Job category description',
    example: 'Software development and engineering positions',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}

